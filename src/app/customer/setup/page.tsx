import ContentsSiteSetup from '@/contents/site/setup'
import SiteShell from '@/components/site'
import SessionAccessGuard from '@/components/site/session-access-guard'
import { getMe } from '@/controller/mobile'
import { getSetupProgress } from '@/controller/site'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { isCustomerRole } from '@/utils/customer-role'
import { getSiteLocale } from '@/utils/site-locale'
import { STAFF_HOME } from '@/utils/constant'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

// Onboarding (W05). The first unfilled step comes from the account
// (church_setup_completed_at / locale_setup_completed_at), on any browser.
// Customer-only (plan 022): a staff session belongs on the dashboard — the staff
// account has no customer data to complete and must not create any.
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')
  if (!isCustomerRole(web.session.user.role)) redirect(STAFF_HOME)

  const userId = web.session.user.user_id
  const progress = await getSetupProgress({ userId })
  if (progress.completed) redirect('/customer')

  const me = await getMe({ userId })
  const initialStep = progress.churchStepDone ? 2 : 1
  const locale = await getSiteLocale()

  // Full-page setup: outside the (profile) customer shell, like /register.
  return (
    <SiteI18nProvider initialLocale={locale}>
      <SessionAccessGuard access="protected" />
      <SiteShell headerVariant="auth">
        <ContentsSiteSetup initialMe={me} initialStep={initialStep} locale={locale} />
      </SiteShell>
    </SiteI18nProvider>
  )
}
