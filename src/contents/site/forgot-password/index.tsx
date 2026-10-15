import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import SanctuaryHeader from '@/components/site/auth/sanctuary-header'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'

import ForgotPasswordForm from './form'

/*
 * Forgot password (W04): the sign-in card without the aside — same header and
 * quote, own title and subtitle, own form. Only the form hydrates.
 */
export default function ContentsSiteForgotPassword({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <AuthLayout
      // Card alone, at the sign-in form width (657px), centered.
      containerClassName="lg:grid-cols-[minmax(0,657px)] lg:justify-center"
      form={
        <AuthCard>
          <SanctuaryHeader subtitle={t('forgotSubtitle')} t={t} title={t('forgotTitle')} />
          <AuthCardSection className="md:pt-0">
            <ForgotPasswordForm />
          </AuthCardSection>
        </AuthCard>
      }
    />
  )
}
