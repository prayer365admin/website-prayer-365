import ContentsSiteSignUp from '@/contents/site/sign-up'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'

// Customer sign-up (W02), 3 steps.
export default async function Page() {
  await redirectAuthenticatedCustomer()
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="guest" />
      <SiteShell footerVariant="legal-only" headerVariant="auth">
        <ContentsSiteSignUp locale={locale} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
