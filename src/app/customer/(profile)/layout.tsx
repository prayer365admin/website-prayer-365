import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import SetupGuard from '@/components/site/setup-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import requiredWebAuth from '@/utils/required-webauth'
import { getSiteLocale } from '@/utils/site-locale'
import { redirect } from 'next/navigation'

/**
 * Customer profile shell. The route group keeps /customer/setup on the
 * no-auth-style onboarding shell while profile pages use the general website chrome.
 * Like the (site) group, the layout itself requires a session, so a page added
 * to this group later cannot be reachable by a guest.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      <SessionAccessGuard access="protected" />
      <SetupGuard />
      <SiteShell>
        <main>{children}</main>
      </SiteShell>
    </SiteI18nProvider>
  )
}
