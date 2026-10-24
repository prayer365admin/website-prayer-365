'use client'

import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import {
  RecoveryBackLink,
  RecoveryCard,
  RecoveryHeading,
  RecoveryLockMark,
  RecoveryResult,
} from '@/components/site/auth/recovery-layout'
import FormError from '@/components/site/form-error'
import { errorCodeOf, useVerifyEmail } from '@/hooks/data/site/verify'
import { useSiteI18n } from '@/i18n/site-i18n'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import ResendForm from './resend-form'

type State = 'idle' | 'verified' | 'invalid' | 'failed'

/*
 * /verify-email?token=… (W03). The user presses "Confirm Email" instead of the
 * page verifying on load: email security scanners open links automatically
 * and would use up the one-time token. Invalid / expired link → resend form.
 */
export default function ConfirmEmail() {
  const { t } = useSiteI18n()
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
      <RecoveryResult
        actionHref="/login"
        actionLabel={t('recoveryLogin')}
        body={t('verifySuccessBody')}
        eyebrow={t('recoveryCongratulations')}
        title={t('verifySuccessTitle')}
      />
    )
  }

  if (state === 'invalid') {
    return (
      <RecoveryCard>
        <RecoveryLockMark />
        <RecoveryHeading body={t('verifyInvalidBody')} title={t('verifyInvalidTitle')} />
        <div className="mt-8">
          <ResendForm centered />
        </div>
        <div className="mt-8 text-left">
          <RecoveryBackLink />
        </div>
      </RecoveryCard>
    )
  }

  return (
    <RecoveryCard>
      <RecoveryLockMark />
      <RecoveryHeading body={t('verifyBody')} title={t('verifyTitle')} />
      {state === 'failed' && <FormError className="mt-6">{t('error')}</FormError>}
      <SiteButton
        className="mt-8 w-full"
        icon={<ArrowRightIcon aria-hidden style={{ fontSize: 18 }} />}
        iconPlacement="end"
        loading={verifying}
        onClick={confirm}
        size="lg"
      >
        {t('verifyConfirm')}
      </SiteButton>
      <div className="mt-8 text-left">
        <RecoveryBackLink />
      </div>
    </RecoveryCard>
  )
}
