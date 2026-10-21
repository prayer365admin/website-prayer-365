import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import SetupGuard from '@/components/site/setup-guard'
import { getMe, listMyChurches } from '@/controller/mobile'
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
  // Seeds the header avatar and church pill on the first render.
  const userId = web.session.user.user_id
  const [me, churches] = await Promise.all([getMe({ userId }), listMyChurches({ userId })])

  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      <SessionAccessGuard access="protected" />
      {customer && <SetupGuard />}
      <SiteShell initialChurches={churches} initialMe={me}>
        {children}
      </SiteShell>
    </SiteI18nProvider>
  )
}
