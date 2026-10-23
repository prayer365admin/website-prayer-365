import ContentsSiteDonate from '@/contents/site/donate'
import { getMyDonationOverview } from '@/controller/donation'
import { getPublicChurch, listMyChurches } from '@/controller/mobile'
import { getNeighborSpotlight } from '@/controller/site'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { isStripeEnabled } from '@/providers/stripe'
import requiredWebAuth from '@/utils/required-webauth'
import { validate } from '@/utils/validate'
import { redirect } from 'next/navigation'

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
  const churchParam = params.church
  const churchSlug =
    (Array.isArray(churchParam) ? churchParam[0] : churchParam)?.trim().toLowerCase() || null
  // Home "One-time Offering" deep link.
  const frequencyParam = params.frequency
  const oneTime =
    (Array.isArray(frequencyParam) ? frequencyParam[0] : frequencyParam) === 'one_time'
  const userId = web.session.user.user_id

  if (!churchSlug) {
    const myChurches = await listMyChurches({ userId })
    const main = myChurches.find((row) => row.isMain)
    // Bake the Main Church default into the URL so it always names the beneficiary.
    if (main?.slug) redirect(`/donate?church=${main.slug}`)

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

  const [church, overview, myChurches] = await Promise.all([
    getPublicChurch({ slug: churchSlug, query: validate(MobileChurchListQuerySchema, {}) }).catch(
      () => null,
    ),
    getMyDonationOverview({ userId }),
    listMyChurches({ userId }),
  ])
  if (!church) redirect('/churches')

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
        isMainParish: myChurches.some((row) => row.isMain && row.churchId === church.id),
      }}
      oneTime={oneTime}
      overview={overview}
      stripeReady={isStripeEnabled()}
      neighbor={neighbor}
      userName={web.session.user.name ?? null}
    />
  )
}
