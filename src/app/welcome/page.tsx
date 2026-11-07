import SessionAccessGuard from '@/components/site/session-access-guard'
import ContentsSiteWelcome from '@/contents/site/welcome'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'
import { getCachedWelcomePublicData } from '@/utils/site-public-cache'

export default async function Page() {
  await redirectAuthenticatedCustomer()
  const [locale, { prayer, memberCount }] = await Promise.all([
    getSiteLocale(),
    getCachedWelcomePublicData(),
  ])

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="guest" />
      <ContentsSiteWelcome memberCount={memberCount} prayer={prayer} />
    </SiteI18nProvider>
  )
}
