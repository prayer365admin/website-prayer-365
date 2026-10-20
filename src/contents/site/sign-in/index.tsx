import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import OAuthButtons from '@/components/site/auth/oauth-buttons'
import SanctuaryHeader from '@/components/site/auth/sanctuary-header'
import SignInAside from '@/components/site/auth/sign-in-aside'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import Link from 'next/link'
import SignInForm from './form'

/*
 * Customer sign-in (W01 / WB-11), design: docs/website/design/wb1/page-sign-in.png.
 * Email + password only. "Member ID", "Keep me signed in", ChurchID (EELK) and
 * Google uses the configured Auth.js provider; Apple remains unavailable.
 *
 * Server component: everything static renders as HTML with no client JS;
 * only <SignInForm /> hydrates (keeps Total Blocking Time low).
 */
export default function ContentsSiteSignIn({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <AuthLayout
      aside={<SignInAside t={t} />}
      // Design: form 657px + 36px gap + aside 459px = 1152px container.
      containerClassName="lg:grid-cols-[minmax(0,657fr)_minmax(0,459fr)] lg:gap-9"
      form={
        <AuthCard>
          <SanctuaryHeader subtitle={t('signInSubtitle')} t={t} title={t('signInTitle')} />

          <AuthCardSection className="md:pt-0">
            <SignInForm />
          </AuthCardSection>

          {/* Not a section: the lines run edge to edge of the card. */}
          <div className="flex items-center gap-4 py-1">
            <span aria-hidden className="h-px flex-1 bg-neutral-200" />
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {t('signInAltDivider')}
            </span>
            <span aria-hidden className="h-px flex-1 bg-neutral-200" />
          </div>

          <AuthCardSection className="pt-4 md:pt-4 grid gap-4 sm:grid-cols-2">
            <OAuthButtons appleLabel={t('signInApple')} googleLabel={t('signInGoogle')} />
          </AuthCardSection>

          <AuthCardSection className="border-t text-sm border-neutral-200 text-center text-neutral-600">
            {t('signInNewHere')}{' '}
            <Link
              className="inline-flex items-center gap-1 text-primary-500 underline"
              href="/register"
            >
              {t('signInBeginFellowship')}
              <ArrowRightIcon aria-hidden style={{ fontSize: 14 }} />
            </Link>
          </AuthCardSection>
        </AuthCard>
      }
    />
  )
}
