import SiteShell from '@/components/site'
import SetupGuard from '@/components/site/setup-guard'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { isCustomerRole } from '@/utils/customer-role'
import requiredWebAuth from '@/utils/required-webauth'
import { getSiteLocale } from '@/utils/site-locale'
import { redirect } from 'next/navigation'

// Website guard (WB-04): every page in this group needs a signed-in user.
// Like mobile auth, any role may use the website and the live user is
// re-checked (active + auth_version) via requiredWebAuth; a disabled account or
// changed password ends the session. Public account pages (/login, /register,
// /verify-email, /forgot-password, /reset-password) live outside this group.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) {
    redirect('/login')
  }
  // Unfinished setup is offered once per browser by SetupGuard (WB-15).
  const customer = isCustomerRole(web.session.user.role)

  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      {customer && <SetupGuard />}
      <SiteShell>{children}</SiteShell>
    </SiteI18nProvider>
  )
}
