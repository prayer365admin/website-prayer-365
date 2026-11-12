import SiteShell from '@/components/site'
import { getMe, listMyChurches } from '@/controller/mobile'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'
import requiredWebAuth from '@/utils/required-webauth'

/*
 * Public church pages (SEO). Lives OUTSIDE the `(site)` group on purpose: that
 * layout calls requiredWebAuth() and sends every visitor to /welcome, so a
 * crawler would only ever see a redirect.
 *
 * No SessionAccessGuard here either: a signed-in visitor must not be bounced
 * away from a page Google indexes. The session only decorates the header, and
 * /churches/[slug]/prayers guards itself.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const locale = await getSiteLocale()
  const web = await requiredWebAuth().catch(() => null)
  const userId = web?.session.user.user_id
  const [me, churches] = userId
    ? await Promise.all([getMe({ userId }), listMyChurches({ userId })])
    : [undefined, undefined]

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell initialMe={me} initialChurches={churches}>
        {children}
      </SiteShell>
    </SiteI18nProvider>
  )
}
