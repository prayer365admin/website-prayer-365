import { db } from '@/utils/db-connection'
import customSlugify from './slugify'

/** Returns a unique stored slug for a church name; retries the random-suffix branch inside customSlugify on the rare spot collision. */
export const buildChurchSlug = async (name: string): Promise<string> => {
  // customSlugify's isExists branch adds one random suffix; loop covers multiple live collisions.
  let current = customSlugify({ text: name, isExists: false })

  for (;;) {
    const taken = await db.church.findFirst({ where: { slug: current }, select: { id: true } })
    if (!taken) return current
    current = customSlugify({ text: name, isExists: true })
  }
}
