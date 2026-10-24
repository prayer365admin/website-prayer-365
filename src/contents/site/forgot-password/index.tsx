import { RecoveryLayout } from '@/components/site/auth/recovery-layout'
import { SiteLocale } from '@/config/site-locale'

import ForgotPasswordForm from './form'

/*
 * Forgot password (W04): the sign-in card without the aside — same header and
 * quote, own title and subtitle, own form. Only the form hydrates.
 */
export default function ContentsSiteForgotPassword({ locale: _locale }: { locale: SiteLocale }) {
  return (
    <RecoveryLayout>
      <ForgotPasswordForm />
    </RecoveryLayout>
  )
}
