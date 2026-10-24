import ContentsSiteDonate from '@/contents/site/donate'
import { getMyDonationOverview } from '@/controller/donation'
import { getMe, getPublicChurch, listMyChurches } from '@/controller/mobile'
import { getNeighborSpotlight } from '@/controller/site'
import { isStripeEnabled } from '@/providers/stripe'
import { GeneralError } from '@/utils/general-error'
import requiredWebAuth from '@/utils/required-webauth'
import { firstParam } from '@/utils/search-param'
import { redirect } from 'next/navigation'

/** The one canonical giving URL shape, shared by both redirects below. */
const donateHref = (slug: string, oneTime: boolean) => {
  const query = new URLSearchParams({ church: slug })
  if (oneTime) query.set('frequency', 'one_time')
  return `/donate?${query.toString()}`
}

/**
 * A church that is missing or not approved is the only EXPECTED failure — it sends
 * the giver to the directory. Everything else (database down, pool exhausted, bad
 * config) must reach the `(site)` error boundary instead of being mislabelled
 * "church not found" and silently redirecting.
 */
const getChurchOrNull = async (identifier: string) => {
  try {
    return await getPublicChurch({ slug: identifier })
  } catch (error) {
    if (error instanceof GeneralError && error.error_code === 'RESOURCE_NOT_FOUND') return null
    throw error
  }
}

// W11 Giving & Stewardship Portal (WB-41). One URL shape: `/donate?church={slug}`
// names the parish receiving the gift. A bare `/donate` resolves to the giver's
// Main Church; without one the portal still renders and asks them to pick.
// Session guard lives in the (site) layout; the page re-reads it to scope the
// giver's own ledger server-side.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const params = await searchParams
  // Stored slugs are generated lower-case, so lower-casing only tolerates a pasted link.
  const identifier = firstParam(params.church)?.toLowerCase() ?? null
  // Home "One-time Offering" deep link.
  const oneTime = firstParam(params.frequency) === 'one_time'
  const userId = web.session.user.user_id

  if (!identifier) {
    const myChurches = await listMyChurches({ userId })
    const main = myChurches.find((row) => row.isMain)
    // Bake the Main Church default into the URL so it always names the beneficiary,
    // carrying the one-time flag the deep link may have arrived with.
    if (main?.slug) redirect(donateHref(main.slug, oneTime))

    return (
      <ContentsSiteDonate
        church={null}
        oneTime={oneTime}
        overview={null}
        stripeReady={isStripeEnabled()}
        userName={web.session.user.name ?? null}
      />
    )
  }

  const [church, overview, me] = await Promise.all([
    getChurchOrNull(identifier),
    getMyDonationOverview({ userId }),
    getMe({ userId }),
  ])
  if (!church) redirect('/churches')
  // The lookup accepts id OR slug (the donation-result fallback links with an id),
  // so rewrite the address bar to the stored slug — canonical, like prayer detail.
  if (identifier !== church.slug) redirect(donateHref(church.slug, oneTime))

  const neighbor = await getNeighborSpotlight({
    churchId: church.id,
    coordinates: church.coordinates,
  })

  return (
    <ContentsSiteDonate
      church={{
        churchId: church.id,
        slug: church.slug,
        churchName: church.name,
        donationOptions: church.donationOptions,
        // One request-cached user read answers this; the church list used to be
        // fetched (with a per-row cover read) just to render one label suffix.
        isMainParish: me.mainChurchId === church.id,
      }}
      oneTime={oneTime}
      overview={overview}
      stripeReady={isStripeEnabled()}
      neighbor={neighbor}
      userName={web.session.user.name ?? null}
    />
  )
}
