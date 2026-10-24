'use client'

import {
  RecoveryBackLink,
  RecoveryCard,
  RecoveryHeading,
  RecoveryLockMark,
} from '@/components/site/auth/recovery-layout'
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
    <RecoveryCard>
      <RecoveryLockMark />
      <RecoveryHeading body={t('verifyPendingBody')} title={t('verifyPendingTitle')} />
      <div className="mt-8">
        <ResendForm initialEmail={email} />
      </div>
      <div className="mt-8">
        <RecoveryBackLink />
      </div>
    </RecoveryCard>
  )
}
