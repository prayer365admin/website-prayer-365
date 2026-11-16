import type { Metadata } from 'next'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import SetupGuard from '@/components/site/setup-guard'
import { SITE_NAME } from '@/config/site-brand'
import ContentsSiteDonationResult from '@/contents/site/donation-result'
import ContentsSiteGiveThankYou from '@/contents/site/give/thank-you'
import { getDonationStatus, getPublicDonationStatus } from '@/controller/donation'
import { getMe, listMyChurches } from '@/controller/mobile'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import {
  DonationStatusQuerySchema,
  type PublicDonationStatusClientView,
  type PublicDonationStatusView,
  PublicDonationStatusQuerySchema,
} from '@/models/donation'
import { type MobileMe, type MobileMyChurch } from '@/models/mobile'
import { isCustomerRole } from '@/utils/customer-role'
import { GeneralError } from '@/utils/general-error'
import requiredWebAuth from '@/utils/required-webauth'
import { firstParam } from '@/utils/search-param'
import { getSiteLocale } from '@/utils/site-locale'
import { redirect } from 'next/navigation'
import { type ReactNode } from 'react'

/** Private outcome screen: never indexed, never cached. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getSiteLocale()
  return {
    title: { absolute: `${SITE_MESSAGES[locale].publicGiveThanksMetaTitle} — ${SITE_NAME}` },
    robots: { index: false, follow: false },
  }
}

type Params = Record<string, string | string[] | undefined>

/*
 * W12 donation result (WB-42) — the ONE thank-you page, on its original URL. The
 * query string only identifies the attempt; every state is read server-side from
 * our own records, so a hand-typed URL can never claim a confirmed gift.
 *
 * A signed-in gift is read against that giver's attempt; a guest gift (`/give`)
 * is read against the platform ledger. Both render the existing outcome
 * components — neither branch is a second page.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
  const locale = await getSiteLocale()
  const web = await requiredWebAuth().catch(() => null)

  let body: ReactNode
  // Seeded into the header so the signed-in branch paints its pill and avatar
  // immediately instead of after the client session resolves.
  let me: MobileMe | undefined
  let churches: MobileMyChurch[] = []

  if (web) {
    const parsed = DonationStatusQuerySchema.safeParse({
      sessionId: firstParam(params.session_id),
      churchId: firstParam(params.churchId) ?? '',
      amountMinor: firstParam(params.amountMinor),
      currency: firstParam(params.currency),
      frequency: firstParam(params.frequency),
    })
    // A malformed result URL names no parish we can honour, so hand the giver to
    // the portal itself: it re-resolves their Main Church.
    if (!parsed.success) redirect('/donate')

    const userId = web.session.user.user_id
    const [status, profile, myChurches] = await Promise.all([
      getDonationStatus({ userId, query: parsed.data }),
      getMe({ userId }),
      listMyChurches({ userId }),
    ])
    me = profile
    churches = myChurches
    const { paidAt: _paidAt, ...initialStatus } = status
    body = (
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
  } else {
    // A parish attempt without a session is not a guest gift: the public read
    // would answer 404 and mislabel a real payment as "checkout not found".
    if (firstParam(params.churchId)) redirect('/login')

    const parsed = PublicDonationStatusQuerySchema.safeParse({
      sessionId: firstParam(params.session_id),
    })
    const sessionId = parsed.success ? parsed.data.sessionId : null

    let initial: PublicDonationStatusView | null = null
    let unknown = !parsed.success
    let notReady = false
    if (parsed.success) {
      try {
        initial = await getPublicDonationStatus({ query: { sessionId: parsed.data.sessionId } })
      } catch (e) {
        if (e instanceof GeneralError && e.code === 503) notReady = true
        else unknown = true
      }
    }
    const initialStatus: PublicDonationStatusClientView | null = initial
      ? { ...initial, paidAt: initial.paidAt?.toISOString() ?? null }
      : null

    body = (
      <ContentsSiteGiveThankYou
        initialStatus={initialStatus}
        notReady={notReady}
        sessionId={sessionId}
        unknown={unknown}
      />
    )
  }

  /*
   * Shell parity with the layouts these two outcomes used before they shared a
   * URL: a guest outcome is the minimal legal footer, a signed-in outcome keeps
   * the full customer shell and its guards (the `(site)` layout's job until the
   * page moved out of that group to stay reachable for guests).
   */
  return (
    <SiteI18nProvider initialLocale={locale}>
      {web && <SessionAccessGuard access="protected" />}
      {web && isCustomerRole(web.session.user.role) && <SetupGuard />}
      <SiteShell
        footerVariant={web ? 'full' : 'legal-only'}
        initialChurches={churches}
        initialMe={me}
      >
        {body}
      </SiteShell>
    </SiteI18nProvider>
  )
}
