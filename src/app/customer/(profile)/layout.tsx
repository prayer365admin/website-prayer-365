import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import SetupGuard from '@/components/site/setup-guard'
import { listMyChurches } from '@/controller/mobile'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { isCustomerRole } from '@/utils/customer-role'
import requiredWebAuth from '@/utils/required-webauth'
import { STAFF_HOME } from '@/utils/constant'
import { getSiteLocale } from '@/utils/site-locale'
import { redirect } from 'next/navigation'
import CustomerProfileHeader from './_components/customer-profile-header'
import ProfileShell from './_components/profile-shell'
import { getMeOnce } from './_data'

/**
 * Customer profile shell. The route group keeps /customer/setup on the
 * no-auth-style onboarding shell while profile pages use the general website chrome,
 * with the customer summary and profile navigation inside it.
 * Like the (site) group, the layout itself requires a session, so a page added
 * to this group later cannot be reachable by a guest.
 *
 * Customer-only (plan 022): a staff session is sent to the dashboard before any
 * read, because a staff account has no user_churches row, no onboarding flags and
 * no business writing customer data. Public pages stay open to staff.
 */
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')
  if (!isCustomerRole(web.session.user.role)) redirect(STAFF_HOME)
  const userId = web.session.user.user_id
  const [me, churches] = await Promise.all([getMeOnce(userId), listMyChurches({ userId })])

  return (
    <SiteI18nProvider initialLocale={await getSiteLocale()}>
      <SessionAccessGuard access="protected" />
      <SetupGuard />
      <SiteShell initialChurches={churches} initialMe={me}>
        <main className="p-6">
          <CustomerProfileHeader
            createdAt={web.user.created_at.toISOString()}
            initialChurches={churches}
            initialMe={me}
            verified={Boolean(web.user.email_verified_at)}
          />
          <ProfileShell>{children}</ProfileShell>
        </main>
      </SiteShell>
    </SiteI18nProvider>
  )
}
