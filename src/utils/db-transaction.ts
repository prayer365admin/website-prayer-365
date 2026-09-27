import { db } from '@/utils/db-connection'
import { Prisma } from '@prisma/client'

export async function dbTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return await db.$transaction(
    async (tx) => {
      return await fn(tx)
    },
    { maxWait: 5000, timeout: 10000 },
  )
}
