import ContentsSiteSignIn from '@/contents/site/sign-in'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import { FEATURED_WELCOME_PRAYER } from '@/config/featured-prayer'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'
import { getCachedLoginExtras } from '@/utils/site-public-cache'

// Customer sign-in (W01). Staff use /admin/login.
export default async function Page() {
  await redirectAuthenticatedCustomer()
  // The aside's prayer + member count are decorative: read from the shared data
  // cache so the form is not blocked behind two DB round trips on every visit.
  const [locale, { prayer, memberCount }] = await Promise.all([
    getSiteLocale(),
    getCachedLoginExtras(),
  ])

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="guest" />
      <SiteShell footerVariant="legal-only" headerVariant="auth">
        <ContentsSiteSignIn
          locale={locale}
          memberCount={memberCount}
          prayer={prayer ?? FEATURED_WELCOME_PRAYER}
        />
      </SiteShell>
    </SiteI18nProvider>
  )
}
