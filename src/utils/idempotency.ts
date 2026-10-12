import { db } from '@/utils/db-connection'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'
import { hashContent } from '@/utils/hash'
import { Prisma } from '@prisma/client'
/*
 * Idempotency (SPEC §6.1): for POST/PUT that create durable effects
 * (voice submit, check-in, donation initiate, request submit, audio queue).
 *
 * `withIdempotency` runs `run(tx)` inside one transaction and atomically
 * persists a `idempotency_records` row (actor_key+operation+key). Replays with
 * the same key AND same request hash return the first result (idempotent).
 * A same key with a DIFFERENT request hash returns 409. Expired keys are
 * ignored/replaced via the row's expires_at check in the provider.
 */

interface IdempotentSpec {
  actorKey: string
  operation: string
  key: string
  requestBody: unknown
  /** Business action, receives the transaction client. Must return a resource id. */
  run: (tx: Prisma.TransactionClient) => Promise<string>
  ttlMinutes?: number
}

// Must be deterministic: a replay compares this against the stored hash.
// (bcrypt `hashSecret` salts randomly, so every replay looked like a conflict.)
export const requestHash = (body: unknown) => hashContent(JSON.stringify(body ?? {}))

export const withIdempotency = async ({
  actorKey,
  operation,
  key,
  requestBody,
  run,
  ttlMinutes = 60 * 24,
}: IdempotentSpec) => {
  if (!key) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'IDEMPOTENCY_KEY_REQUIRED',
      details: 'Idempotency-Key header is required.',
    })
  }

  const hash = requestHash(requestBody)

  return dbTransaction(async (tx) => {
    const expires_at = new Date(Date.now() + ttlMinutes * 60 * 1000)
    const existing = await tx.idempotencyRecord.findFirst({
      where: { actor_key: actorKey, operation, key },
    })

    const notExpired = existing && existing.expires_at > new Date()
    if (notExpired) {
      if (existing!.request_hash === hash) {
        return { fresh: false as const, resource_id: existing!.resource_id }
      }
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'IDEMPOTENCY_CONFLICT',
        details: 'Idempotency key was used with a different request.',
      })
    }

    // Absent or expired key → run the business action and (re)persist the record.
    if (existing) {
      await tx.idempotencyRecord.delete({ where: { id: existing.id } })
    }
    const resource_id = await run(tx)
    await tx.idempotencyRecord.create({
      data: {
        actor_key: actorKey,
        operation,
        key,
        request_hash: hash,
        resource_id,
        state: 'COMPLETED',
        expires_at,
      },
    })
    return { fresh: true as const, resource_id }
  })
}

export interface ExternalIdempotentSpec {
  actorKey: string
  operation: string
  key: string
  requestBody: unknown
  /**
   * Business action executed OUTSIDE any DB transaction to avoid
   * holding database connections open during long third-party network calls.
   */
  run: () => Promise<string>
  ttlMinutes?: number
}

/**
 * Two-phase idempotency wrapper for operations involving external API calls (e.g. Stripe checkout).
 * Phase 1: Atomically checks idempotency and reserves a PENDING record.
 * Phase 2: Executes the external action outside of any DB transaction.
 * Phase 3: Updates the record to COMPLETED (or cleans up on failure so retries succeed).
 */
export const withExternalIdempotency = async ({
  actorKey,
  operation,
  key,
  requestBody,
  run,
  ttlMinutes = 60 * 24,
}: ExternalIdempotentSpec): Promise<{ fresh: boolean; resource_id: string | null }> => {
  if (!key) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'IDEMPOTENCY_KEY_REQUIRED',
      details: 'Idempotency-Key header is required.',
    })
  }

  const hash = requestHash(requestBody)
  const expires_at = new Date(Date.now() + ttlMinutes * 60 * 1000)

  const reservation = await dbTransaction(async (tx) => {
    const existing = await tx.idempotencyRecord.findFirst({
      where: { actor_key: actorKey, operation, key },
    })

    const notExpired = existing && existing.expires_at > new Date()
    if (notExpired) {
      if (existing.request_hash !== hash) {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'IDEMPOTENCY_CONFLICT',
          details: 'Idempotency key was used with a different request.',
        })
      }
      if (existing.state === 'COMPLETED') {
        return { status: 'completed' as const, resource_id: existing.resource_id }
      }
      if (existing.state === 'PENDING') {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'IDEMPOTENCY_IN_FLIGHT',
          details: 'A request with this idempotency key is currently being processed.',
        })
      }
    }

    if (existing) {
      await tx.idempotencyRecord.delete({ where: { id: existing.id } })
    }

    const pending = await tx.idempotencyRecord.create({
      data: {
        actor_key: actorKey,
        operation,
        key,
        request_hash: hash,
        state: 'PENDING',
        expires_at,
      },
    })

    return { status: 'reserved' as const, recordId: pending.id }
  })

  if (reservation.status === 'completed') {
    return { fresh: false, resource_id: reservation.resource_id }
  }

  let resource_id: string
  try {
    resource_id = await run()
  } catch (err) {
    await db.idempotencyRecord
      .deleteMany({
        where: { id: reservation.recordId, state: 'PENDING' },
      })
      .catch(() => {})
    throw err
  }

  await db.idempotencyRecord.update({
    where: { id: reservation.recordId },
    data: {
      resource_id,
      state: 'COMPLETED',
    },
  })

  return { fresh: true, resource_id }
}
