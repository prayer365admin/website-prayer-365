import ContentsSiteResetPassword from '@/contents/site/reset-password'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'

// Reset password (W04). Shared by customers and staff.
export default async function Page() {
  await redirectAuthenticatedCustomer()
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="guest" />
      <SiteShell headerVariant="auth">
        <ContentsSiteResetPassword locale={locale} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
