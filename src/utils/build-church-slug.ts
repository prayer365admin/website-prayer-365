import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import customSlugify from './slugify'

/**
 * Returns a unique stored slug for a church name; retries the random-suffix branch inside customSlugify on the rare spot collision.
 *
 * `client` must be the SAME client the caller inserts with: prod pools are
 * max 1 connection per instance, so a lookup on `db` from inside an open
 * transaction waits for a connection the transaction itself is holding and
 * only ends when the transaction timeout fires.
 */
export const buildChurchSlug = async (
  name: string,
  client: Prisma.TransactionClient = db,
): Promise<string> => {
  // customSlugify's isExists branch adds one random suffix; loop covers multiple live collisions.
  let current = customSlugify({ text: name, isExists: false })

  for (;;) {
    const taken = await client.church.findFirst({
      where: { slug: current },
      select: { id: true },
    })
    if (!taken) return current
    current = customSlugify({ text: name, isExists: true })
  }
}
