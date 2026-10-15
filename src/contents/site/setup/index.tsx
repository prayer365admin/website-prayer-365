import { AuthCard } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import SignUpAside from '@/components/site/auth/sign-up-aside'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import { MobileMe } from '@/models/mobile'
import SetupForm from './form'

/*
 * First-login onboarding (W05 / WB-15): parish (optional) and language, after
 * the account exists (R-06). Same frame as the sign-up page; only <SetupForm />
 * hydrates.
 */
export default function ContentsSiteSetup({
  locale,
  initialMe,
  initialStep,
}: {
  locale: SiteLocale
  initialMe?: MobileMe
  initialStep?: 1 | 2
}) {
  return (
    <AuthLayout
      aside={<SignUpAside t={siteT(locale)} />}
      asideFirst
      // Design: aside 466px + 24px gap + form 662px = 1152px container.
      containerClassName="lg:grid-cols-[minmax(0,466fr)_minmax(0,662fr)] lg:gap-6"
      form={
        <AuthCard>
          <SetupForm initialMe={initialMe} initialStep={initialStep} />
        </AuthCard>
      }
    />
  )
}
