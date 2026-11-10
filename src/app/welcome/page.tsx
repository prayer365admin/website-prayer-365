import type { Metadata } from 'next'
import SessionAccessGuard from '@/components/site/session-access-guard'
import ContentsSiteWelcome from '@/contents/site/welcome'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/config/site-brand'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import redirectAuthenticatedCustomer from '@/utils/redirect-authenticated-customer'
import { getSiteLocale } from '@/utils/site-locale'
import { getCachedWelcomePublicData } from '@/utils/site-public-cache'

// The landing page is the only public marketing surface, so it is the one page
// that opts back into indexing (root metadata is default-deny).
export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/welcome' },
  robots: { index: true, follow: true },
}

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
