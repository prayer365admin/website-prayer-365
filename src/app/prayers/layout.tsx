import SiteShell from '@/components/site'
import { getMe, listMyChurches } from '@/controller/mobile'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'
import requiredWebAuth from '@/utils/required-webauth'

/*
 * Public prayer pages (general prayer, D-GP-7). Lives OUTSIDE the `(site)`
 * group for the same reason `/churches` does: that layout calls
 * requiredWebAuth() and redirects every guest to /welcome, and both the daily
 * email and the push notification land on devices with no session at all.
 *
 * No SessionAccessGuard: a signed-in visitor must not be bounced either. The
 * session only decorates the header — the member-only `/prayers` archive stays
 * inside `(site)` and keeps its own guard.
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
