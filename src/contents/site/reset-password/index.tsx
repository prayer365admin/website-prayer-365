import { RecoveryLayout } from '@/components/site/auth/recovery-layout'
import { SiteLocale } from '@/config/site-locale'
import { Suspense } from 'react'
import ResetPasswordForm from './form'

/*
 * Reset password (W04): the sign-in card without the aside — same header and
 * quote, own title and subtitle, own form. Only the form hydrates.
 */
export default function ContentsSiteResetPassword({ locale: _locale }: { locale: SiteLocale }) {
  return (
    <RecoveryLayout>
      {/* useSearchParams (token) needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </RecoveryLayout>
  )
}
