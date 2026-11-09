import { db } from '@/utils/db-connection'
import { Prisma } from '@prisma/client'

// Ceilings, not speed-ups: a transaction that hits these is stuck (e.g. waiting
// on a second pool connection in prod, where the pool is max 1). Keep them below
// the platform function limit so the 5xx carries the transaction error, not a
// gateway timeout. maxWait 10s matches the pool connectionTimeoutMillis.
const TX_MAX_WAIT_MS = 10000
const TX_TIMEOUT_MS = 20000

export async function dbTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return await db.$transaction(
    async (tx) => {
      return await fn(tx)
    },
    { maxWait: TX_MAX_WAIT_MS, timeout: TX_TIMEOUT_MS },
  )
}
