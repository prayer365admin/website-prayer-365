import crypto from 'crypto'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import {
  StripeWebhookEventSchema,
  ParsedWebhookEvent,
  StripeWebhookResult,
} from '@/models/stripe-webhook'
import { Prisma } from '@prisma/client'

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
  const accountId = event.account ?? (event.data.object.account as string | undefined) ?? 'platform'

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
        return {
          received: true,
          duplicate: true,
          ignored: existing.state.startsWith('IGNORED'),
          receiptId: existing.id,
        }
      }

      // Step 2: Unknown account protection
      const paymentAccount = await tx.paymentAccount.findFirst({
        where: {
          provider: 'stripe',
          provider_account_id: accountId,
        },
      })

      if (!paymentAccount) {
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
            paymentAccountId: paymentAccount.id,
            churchId: paymentAccount.church_id,
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
