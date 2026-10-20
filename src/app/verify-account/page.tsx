import ContentsSiteVerify from '@/contents/site/verify'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'

// Email verification (W03, pending).
export default async function Page() {
  await redirectAuthenticatedCustomer()
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="guest" />
      <SiteShell headerVariant="auth">
        <ContentsSiteVerify locale={locale} mode="pending" />
      </SiteShell>
    </SiteI18nProvider>
  )
}
