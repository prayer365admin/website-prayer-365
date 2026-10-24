import { RecoveryLayout } from '@/components/site/auth/recovery-layout'
import { SiteLocale } from '@/config/site-locale'
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
  mode,
}: {
  locale: SiteLocale
  mode: 'confirm' | 'pending'
}) {
  return (
    <RecoveryLayout>
      {/* useSearchParams (token / email) needs a Suspense boundary. */}
      <Suspense fallback={null}>
        {mode === 'confirm' ? <ConfirmEmail /> : <PendingVerification />}
      </Suspense>
    </RecoveryLayout>
  )
}
