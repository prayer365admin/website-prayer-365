import ContentsSiteDonationResult from '@/contents/site/donation-result'
import { getDonationStatus } from '@/controller/donation'
import { DonationStatusQuerySchema } from '@/models/donation'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

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
  const churchId = first(params.churchId) ?? ''
  const parsed = DonationStatusQuerySchema.safeParse({
    sessionId: first(params.session_id),
    churchId,
    amountMinor: first(params.amountMinor),
    currency: first(params.currency),
    frequency: first(params.frequency),
  })
  if (!parsed.success) redirect(churchId ? `/donate/${churchId}` : '/churches')

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
