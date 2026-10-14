'use client'

import { AuthCardSection } from '@/components/site/auth/auth-card'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSearchParams } from 'next/navigation'
import ResendForm from './resend-form'

/*
 * /verify-account?email=… (W03): where sign-in sends an unverified account.
 * Explains the state and offers a new link, prefilled with the email.
 */
export default function PendingVerification() {
  const { t } = useSiteI18n()
  const email = useSearchParams().get('email') ?? ''

  return (
    <>
      <AuthCardSection>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-500">
          {t('signUpEyebrow')}
        </span>
        <h1 className="mt-2 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
          {t('verifyPendingTitle')}
        </h1>
        <p className="mt-2 text-neutral-600">{t('verifyPendingBody')}</p>
      </AuthCardSection>
      <AuthCardSection className="border-t border-neutral-200">
        <ResendForm initialEmail={email} />
      </AuthCardSection>
    </>
  )
}
