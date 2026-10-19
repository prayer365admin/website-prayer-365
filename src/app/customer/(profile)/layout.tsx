import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import SetupGuard from '@/components/site/setup-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { getSiteLocale } from '@/utils/site-locale'

/**
 * Customer profile shell. The route group keeps /customer/setup on the
 * no-auth-style onboarding shell while profile pages use the general website chrome.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
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
