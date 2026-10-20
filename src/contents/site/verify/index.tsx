import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import SignUpAside from '@/components/site/auth/sign-up-aside'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import Link from 'next/link'
import { Suspense } from 'react'
import ConfirmEmail from './confirm'
import PendingVerification from './pending'

/*
 * Email verification (W03), no image design: sign-up card style and aside
 * (verification continues the enrollment). `confirm` = the email link page
 * (/verify-email), `pending` = sign-in found an unverified account
 * (/verify-account). Only the card body hydrates.
 */
export default function ContentsSiteVerify({
  locale,
  mode,
}: {
  locale: SiteLocale
  mode: 'confirm' | 'pending'
}) {
  const t = siteT(locale)

  return (
    <AuthLayout
      aside={<SignUpAside t={t} />}
      asideFirst
      // Design: aside 466px + 24px gap + form 662px = 1152px container.
      containerClassName="lg:grid-cols-[minmax(0,466fr)_minmax(0,662fr)] lg:gap-6"
      form={
        <AuthCard>
          {/* useSearchParams (token / email) needs a Suspense boundary. */}
          <Suspense fallback={null}>
            {mode === 'confirm' ? <ConfirmEmail /> : <PendingVerification />}
          </Suspense>
          <AuthCardSection className="border-t border-neutral-200 text-center text-sm">
            <Link className="font-semibold text-primary-500" href="/login">
              {t('signUpSuccessAction')}
            </Link>
          </AuthCardSection>
        </AuthCard>
      }
    />
  )
}
