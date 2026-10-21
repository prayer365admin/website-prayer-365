import ContentsSiteDonate from '@/contents/site/donate'
import { getMyDonationOverview } from '@/controller/donation'
import { getPublicChurch, listMyChurches } from '@/controller/mobile'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { isStripeEnabled } from '@/providers/stripe'
import requiredWebAuth from '@/utils/required-webauth'
import { validate } from '@/utils/validate'
import { redirect } from 'next/navigation'

// W11 Giving & Stewardship Portal (WB-41). Session guard lives in the (site)
// layout; the page re-reads it to scope the giver's own ledger server-side.
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ churchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const { churchId } = await params
  // Home "One-time Offering" deep link.
  const oneTime = (await searchParams).frequency === 'one_time'
  const userId = web.session.user.user_id
  const [church, overview, myChurches] = await Promise.all([
    getPublicChurch({ churchId, query: validate(MobileChurchListQuerySchema, {}) }).catch(
      () => null,
    ),
    getMyDonationOverview({ userId }),
    listMyChurches({ userId }),
  ])
  if (!church) redirect('/churches')

  return (
    <ContentsSiteDonate
      churchId={church.id}
      churchName={church.name}
      donationOptions={church.donationOptions}
      oneTime={oneTime}
      isMainParish={myChurches.some((row) => row.isMain && row.churchId === church.id)}
      overview={overview}
      stripeReady={isStripeEnabled()}
      userName={web.session.user.name ?? null}
    />
  )
}
