import ContentsSitePrivacy from '@/contents/site/privacy'
import SiteShell from '@/components/site'
import { SITE_NAME } from '@/config/site-brand'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'
import { Metadata } from 'next'

/*
 * Public policy page (/privacy). Lives OUTSIDE the `(site)` group: that layout
 * calls requiredWebAuth() and would send visitors to /welcome, but the policies
 * must be readable before sign-up and while the platform is in maintenance
 * (src/proxy.ts lists /privacy among the open paths).
 *
 * No SessionAccessGuard on purpose: this page belongs to every visitor. The
 * guard's only modes are `protected` and `guest`, and `guest` would send a
 * signed-in customer to SITE_HOME when the page is restored from the
 * back/forward cache — exactly wrong for a document they already accepted.
 *
 * One page for all three documents: the footer already links to /privacy and
 * /terms, and /terms + /cookies redirect into the anchors defined here.
 */
export const metadata: Metadata = {
  title: 'Privacy Policy, Terms & Cookie Policy',
  description: `Privacy policy, terms of fellowship and cookie policy for ${SITE_NAME}.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
}

export default async function Page() {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell footerVariant="legal-only" headerVariant="none">
        <ContentsSitePrivacy locale={locale} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
