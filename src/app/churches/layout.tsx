import SiteShell from '@/components/site'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

/*
 * Public church pages (SEO). Lives OUTSIDE the `(site)` group on purpose: that
 * layout calls requiredWebAuth() and sends every visitor to /welcome, so a
 * crawler would only ever see a redirect. The URLs are unchanged (/churches),
 * so no link, bookmark or mobile deep link needs editing.
 *
 * No SessionAccessGuard here either: a signed-in visitor must not be bounced
 * away from a page Google indexes. /churches/[slug]/prayers guards itself.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale = await getSiteLocale()

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell>{children}</SiteShell>
    </SiteI18nProvider>
  )
}
