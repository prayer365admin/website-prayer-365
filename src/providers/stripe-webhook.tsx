import crypto from 'crypto'
import { PLATFORM_ACCOUNT_ID } from './stripe'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import {
  StripeWebhookEventSchema,
  ParsedWebhookEvent,
  StripeWebhookResult,
} from '@/models/stripe-webhook'
import { Prisma } from '@prisma/client'

/** Events recorded but with nothing to sync — receipt finalized at ingress, no job. */
const NO_SYNC_EVENT_TYPES = new Set(['checkout.session.completed'])

export function verifyStripeWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = 300,
}: {
  rawBody: string
  signatureHeader: string | null
  secret: string
  toleranceSeconds?: number
}): { valid: true; timestamp: number } {
  if (!signatureHeader || !secret) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_SIGNATURE',
      details: 'Missing Stripe signature header.',
    })
  }

  const parts = signatureHeader.split(',')
  let timestamp = 0
  const v1Signatures: string[] = []

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key === 't') {
      timestamp = parseInt(value, 10)
    } else if (key === 'v1') {
      v1Signatures.push(value)
    }
  }

  if (!timestamp || v1Signatures.length === 0) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_SIGNATURE',
      details: 'Malformed Stripe signature header.',
    })
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'TIMESTAMP_OUT_OF_RANGE',
      details: 'Stripe signature timestamp expired or out of tolerance.',
    })
  }

  const payload = `${timestamp}.${rawBody}`
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const computedBuffer = Buffer.from(computed, 'utf8')

  let isValid = false
  for (const v1 of v1Signatures) {
    const v1Buffer = Buffer.from(v1, 'utf8')
    if (
      computedBuffer.length === v1Buffer.length &&
      crypto.timingSafeEqual(computedBuffer, v1Buffer)
    ) {
      isValid = true
      break
    }
  }

  if (!isValid) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_SIGNATURE',
      details: 'Stripe signature verification failed.',
    })
  }

  return { valid: true, timestamp }
}

export function parseStripeWebhookEvent(rawBody: string): ParsedWebhookEvent {
  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PAYLOAD',
      details: 'Invalid JSON payload.',
    })
  }

  const result = StripeWebhookEventSchema.safeParse(json)
  if (!result.success) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_PAYLOAD',
      details: 'Payload does not match expected Stripe webhook event schema.',
    })
  }

  const event = result.data
  const objectId = String(event.data.object.id ?? '')

  return { ...event, objectId }
}

export async function RECORD_STRIPE_WEBHOOK_RECEIPT({
  event,
}: {
  event: ParsedWebhookEvent
}): Promise<StripeWebhookResult> {
  const accountId =
    event.account ?? (event.data.object.account as string | undefined) ?? PLATFORM_ACCOUNT_ID()

  try {
    return await db.$transaction(async (tx) => {
      // Step 1: Idempotency check
      const existing = await tx.webhookReceipt.findUnique({
        where: {
          provider_account_id_event_id: {
            provider: 'stripe',
            account_id: accountId,
            event_id: event.id,
          },
        },
      })

      if (existing) {
        if (existing.state === 'FAILED') {
          const dedupeKey = `payment.sync:stripe:${accountId}:${event.id}`
          const job = await tx.outboxJob.findFirst({
            where: {
              kind: 'payment.sync',
              dedupe_key: dedupeKey,
            },
          })

          if (job) {
            await tx.outboxJob.update({
              where: { id: job.id },
              data: {
                state: 'PENDING',
                attempts: 0,
                lease_until: null,
                available_at: new Date(),
                last_error_code: null,
              },
            })
            await tx.webhookReceipt.update({
              where: { id: existing.id },
              data: { state: 'PENDING' },
            })
            return {
              received: true,
              duplicate: true,
              ignored: false,
              receiptId: existing.id,
              jobId: job.id,
            }
          }

          const isPlatform = accountId === PLATFORM_ACCOUNT_ID()

          if (isPlatform) {
            const newJob = await tx.outboxJob.create({
              data: {
                kind: 'payment.sync',
                dedupe_key: dedupeKey,
                resource_id: existing.id,
                payload: {
                  provider: 'stripe',
                  accountId,
                  eventId: event.id,
                  eventType: event.type,
                  objectId: event.objectId,
                  eventCreated: event.created,
                  dataObject: event.data.object as Prisma.InputJsonValue,
                },
                available_at: new Date(),
                state: 'PENDING',
              },
            })
            await tx.webhookReceipt.update({
              where: { id: existing.id },
              data: { state: 'PENDING' },
            })
            return {
              received: true,
              duplicate: true,
              ignored: false,
              receiptId: existing.id,
              jobId: newJob.id,
            }
          }
        }

        return {
          received: true,
          duplicate: true,
          ignored: existing.state.startsWith('IGNORED'),
          receiptId: existing.id,
        }
      }

      // Step 2: Unknown account protection
      const isPlatform = accountId === PLATFORM_ACCOUNT_ID()

      if (!isPlatform) {
        const receipt = await tx.webhookReceipt.create({
          data: {
            provider: 'stripe',
            account_id: accountId,
            event_id: event.id,
            event_type: event.type,
            object_id: event.objectId,
            received_at: new Date(),
            processed_at: new Date(),
            state: 'IGNORED_UNKNOWN_ACCOUNT',
          },
        })

        return {
          received: true,
          duplicate: false,
          ignored: true,
          receiptId: receipt.id,
        }
      }

      // Step 3: Known account persistence & job outbox
      if (NO_SYNC_EVENT_TYPES.has(event.type)) {
        const receipt = await tx.webhookReceipt.create({
          data: {
            provider: 'stripe',
            account_id: accountId,
            event_id: event.id,
            event_type: event.type,
            object_id: event.objectId,
            received_at: new Date(),
            processed_at: new Date(),
            state: 'PROCESSED',
          },
        })

        return {
          received: true,
          duplicate: false,
          ignored: true,
          receiptId: receipt.id,
        }
      }

      const receipt = await tx.webhookReceipt.create({
        data: {
          provider: 'stripe',
          account_id: accountId,
          event_id: event.id,
          event_type: event.type,
          object_id: event.objectId,
          received_at: new Date(),
          state: 'PENDING',
        },
      })

      const job = await tx.outboxJob.create({
        data: {
          kind: 'payment.sync',
          dedupe_key: `payment.sync:stripe:${accountId}:${event.id}`,
          resource_id: receipt.id,
          payload: {
            provider: 'stripe',
            accountId,
            eventId: event.id,
            eventType: event.type,
            objectId: event.objectId,
            eventCreated: event.created,
            dataObject: event.data.object as Prisma.InputJsonValue,
          },
          available_at: new Date(),
          state: 'PENDING',
        },
      })
      return {
        received: true,
        duplicate: false,
        ignored: false,
        receiptId: receipt.id,
        jobId: job.id,
      }
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return {
        received: true,
        duplicate: true,
        ignored: false, // Could technically be ignored, but we treat it safely
      }
    }
    throw e
  }
}
