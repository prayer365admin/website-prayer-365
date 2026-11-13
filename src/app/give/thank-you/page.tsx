import type { Metadata } from 'next'
import SiteShell from '@/components/site'
import ContentsSiteGiveThankYou from '@/contents/site/give/thank-you'
import { getPublicDonationStatus } from '@/controller/donation'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import {
  type PublicDonationStatusClientView,
  PublicDonationStatusQuerySchema,
} from '@/models/donation'
import { firstParam } from '@/utils/search-param'
import { getSiteLocale } from '@/utils/site-locale'

/** Private outcome screen: never indexed, never cached. */
export const metadata: Metadata = {
  title: 'Thank you — Prayer 365',
  robots: { index: false, follow: false },
}

/**
 * `/give/thank-you` (PD-UI-03). Public like `/give` — outside the `(site)` group
 * for the same reason. The query string only names the checkout session; the
 * outcome is read server-side from our ledger (and polled from the browser while
 * it settles). A session that is malformed or not the platform's own answers
 * 404 and renders as failed, so a crafted URL can never fake a confirmation.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const locale = await getSiteLocale()
  const parsed = PublicDonationStatusQuerySchema.safeParse({
    sessionId: firstParam(params.session_id),
  })
  const sessionId = parsed.success ? parsed.data.sessionId : null
  const initial = parsed.success
    ? await getPublicDonationStatus({ query: { sessionId: parsed.data.sessionId } }).catch(
        () => null,
      )
    : null
  // The client re-reads the same shape over JSON, where the timestamp is a string.
  const initialStatus: PublicDonationStatusClientView | null = initial
    ? { ...initial, paidAt: initial.paidAt?.toISOString() ?? null }
    : null

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell footerVariant="legal-only" headerVariant="auth">
        <ContentsSiteGiveThankYou initialStatus={initialStatus} sessionId={sessionId} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
