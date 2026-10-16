import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import SanctuaryHeader from '@/components/site/auth/sanctuary-header'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import { Suspense } from 'react'
import ResetPasswordForm from './form'

/*
 * Reset password (W04): the sign-in card without the aside — same header and
 * quote, own title and subtitle, own form. Only the form hydrates.
 */
export default function ContentsSiteResetPassword({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <AuthLayout
      // Card alone, at the sign-in form width (657px), centered.
      containerClassName="lg:grid-cols-[minmax(0,657px)] lg:justify-center"
      form={
        <AuthCard>
          <SanctuaryHeader subtitle={t('resetSubtitle')} t={t} title={t('resetTitle')} />
          <AuthCardSection className="md:pt-0">
            {/* useSearchParams (token) needs a Suspense boundary. */}
            <Suspense fallback={null}>
              <ResetPasswordForm />
            </Suspense>
          </AuthCardSection>
        </AuthCard>
      }
    />
  )
}
