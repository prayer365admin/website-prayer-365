import ContentsSiteDonationReturn from '@/contents/site/donation-return'
import SiteShell from '@/components/site'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { firstParam } from '@/utils/search-param'
import { getSiteLocale } from '@/utils/site-locale'

/**
 * F11 return landing page (WB4b). The provider redirects the giver here with
 * `?outcome=success|cancel`. With the app installed this URL never reaches the
 * browser (it is a verified universal link); this page is the fallback for a
 * device without the app or a link that failed verification.
 *
 * Lives OUTSIDE the `(site)` group on purpose: that layout calls `requiredWebAuth`
 * and would bounce a giver straight from a checkout into `/login` (verified
 * 2026-10-29 against the deployed build). It is a public page, like `/login` —
 * no session is read, and nothing about a payment is decided here: the app reads
 * the outcome from the ledger.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const outcome = firstParam(params.outcome) ?? null
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell footerVariant="legal-only" headerVariant="auth">
        <ContentsSiteDonationReturn outcome={outcome} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
