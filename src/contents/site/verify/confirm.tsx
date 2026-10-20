'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { SuccessIcon } from '@/components/icon/success'
import { AuthCardSection } from '@/components/site/auth/auth-card'
import FormError from '@/components/site/form-error'
import { errorCodeOf, useVerifyEmail } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import ResendForm from './resend-form'

type State = 'idle' | 'verified' | 'invalid' | 'failed'

const heading =
  'mt-2 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]'

/*
 * /verify-email?token=… (W03). The user presses "Confirm Email" instead of the
 * page verifying on load: email security scanners open links automatically
 * and would use up the one-time token. Invalid / expired link → resend form.
 */
export default function ConfirmEmail() {
  const { t } = useSiteI18n()
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const { onVerify, verifying } = useVerifyEmail()
  const [state, setState] = useState<State>(token ? 'idle' : 'invalid')

  const confirm = async () => {
    try {
      await onVerify(token)
      setState('verified')
    } catch (e) {
      const code = errorCodeOf(e)
      setState(code === 'INVALID_OR_EXPIRED' || code === 'INVALID_TOKEN' ? 'invalid' : 'failed')
    }
  }

  if (state === 'verified') {
    return (
      <AuthCardSection className="text-center">
        <SuccessIcon aria-hidden className="mx-auto block" style={{ fontSize: 120 }} />
        <h1 className={heading}>{t('verifySuccessTitle')}</h1>
        <p className="mt-2 text-neutral-600">{t('verifySuccessBody')}</p>
        <SiteButton
          className="mx-auto mt-6 w-full md:w-auto"
          desktopSize="lg"
          icon={<ArrowRightIcon aria-hidden style={{ fontSize: 24 }} />}
          iconPlacement="end"
          onClick={() => router.push('/login')}
          size="md"
        >
          {t('signUpSignIn')}
        </SiteButton>
      </AuthCardSection>
    )
  }

  if (state === 'invalid') {
    return (
      <>
        <AuthCardSection className="text-center">
          <h1 className={heading}>{t('verifyInvalidTitle')}</h1>
          <p className="mt-2 text-neutral-600">{t('verifyInvalidBody')}</p>
        </AuthCardSection>
        <AuthCardSection className="border-t border-neutral-200 text-center">
          <ResendForm centered />
        </AuthCardSection>
      </>
    )
  }

  return (
    <AuthCardSection className="text-center">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-500">
        {t('verifyEyebrow')}
      </span>
      <h1 className={heading}>{t('verifyTitle')}</h1>
      <p className="mt-2 text-neutral-600">{t('verifyBody')}</p>
      {state === 'failed' && <FormError className="mt-6">{t('error')}</FormError>}
      <SiteButton
        className="mx-auto mt-6 w-full md:w-auto"
        desktopSize="lg"
        loading={verifying}
        onClick={confirm}
        size="md"
      >
        {t('verifyConfirm')}
      </SiteButton>
    </AuthCardSection>
  )
}
