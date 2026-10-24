import ContentsSiteDonationResult from '@/contents/site/donation-result'
import { getDonationStatus } from '@/controller/donation'
import { DonationStatusQuerySchema } from '@/models/donation'
import requiredWebAuth from '@/utils/required-webauth'
import { firstParam } from '@/utils/search-param'
import { redirect } from 'next/navigation'

// W12 donation result (WB-42). The query string only identifies the attempt:
// the outcome is read from our ledger server-side, so a hand-typed URL can never
// claim a confirmed gift.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const params = await searchParams
  const churchId = firstParam(params.churchId) ?? ''
  const parsed = DonationStatusQuerySchema.safeParse({
    sessionId: firstParam(params.session_id),
    churchId,
    amountMinor: firstParam(params.amountMinor),
    currency: firstParam(params.currency),
    frequency: firstParam(params.frequency),
  })
  // A malformed result URL names no parish we can honour, so hand the giver to
  // the portal itself: it re-resolves their Main Church.
  if (!parsed.success) redirect('/donate')

  const status = await getDonationStatus({
    userId: web.session.user.user_id,
    query: parsed.data,
  })
  const { paidAt: _paidAt, ...initialStatus } = status

  return (
    <ContentsSiteDonationResult
      attempt={{
        sessionId: parsed.data.sessionId,
        churchId: parsed.data.churchId,
        amountMinor: parsed.data.amountMinor,
        currency: parsed.data.currency,
        frequency: parsed.data.frequency,
      }}
      initialStatus={initialStatus}
    />
  )
}
