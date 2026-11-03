import { unstable_cache } from 'next/cache'
import { getLatestPlayableSitePrayer } from '@/controller/site-prayer'
import { getFellowshipMemberCount } from '@/controller/user'
import { SITE_PUBLIC_TAG } from '@/utils/site-cache-tags'

/**
 * Website content that is identical for every visitor, cached in the Next data
 * cache so a page render does not pay a fresh DB round trip each time.
 *
 * Rule: only PUBLIC, user-independent reads belong here. Anything scoped to the
 * session user (me, my churches, habits, donations, requests) must stay
 * uncached — pass the user id as an argument to the cached function if it has to
 * be there, or keep it out entirely.
 *
 * Invalidate after a mutation that changes what visitors see
 * (`revalidateTag(SITE_PUBLIC_TAG)`) — publishing/approving a prayer, approving a
 * church, publishing an announcement. The TTL is only a backstop.
 */

/** Sign-in aside: newest playable prayer + fellowship member count (decorative). */
export const getCachedLoginExtras = unstable_cache(
  async () => {
    const [prayer, memberCount] = await Promise.all([
      getLatestPlayableSitePrayer().catch(() => null),
      getFellowshipMemberCount().catch(() => null),
    ])
    return { prayer, memberCount }
  },
  ['site-login-extras'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)

/** Welcome page: newest playable prayer + fellowship member count. */
export const getCachedWelcomePublicData = unstable_cache(
  async () => {
    const [prayer, memberCount] = await Promise.all([
      getLatestPlayableSitePrayer().catch(() => null),
      getFellowshipMemberCount().catch(() => null),
    ])
    return { prayer, memberCount }
  },
  ['site-welcome-public-data'],
  { revalidate: 60, tags: [SITE_PUBLIC_TAG] },
)
