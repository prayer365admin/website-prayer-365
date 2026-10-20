import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import SignUpAside from '@/components/site/auth/sign-up-aside'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import { RegionalSanctuaryStats } from '@/models/regional-sanctuary-stats'
import Link from 'next/link'
import SignUpForm from './form'

/*
 * Customer sign-up (W02 / WB-12), 3 steps. Server component: the aside and
 * the card footer render as HTML; only <SignUpForm /> (header with the step
 * counter + the steps) hydrates.
 */
export default function ContentsSiteSignUp({
  locale,
  regionalStats = null,
}: {
  locale: SiteLocale
  regionalStats?: RegionalSanctuaryStats | null
}) {
  const t = siteT(locale)

  return (
    <AuthLayout
      aside={<SignUpAside locale={locale} stats={regionalStats} t={t} />}
      asideFirst
      // Design: aside 466px + 24px gap + form 662px = 1152px container.
      containerClassName="lg:grid-cols-[minmax(0,466fr)_minmax(0,662fr)] lg:gap-6"
      // Soft blue dot behind the form's right edge (design: 384 x 419, #83C0FF33,
      // blur 64px). filter blur, not backdrop-filter: the dot itself is soft.
      decoration={
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/3 h-[419px] w-96 rounded-full bg-[var(--color-dot-blue)] blur-[64px]"
        />
      }
      form={
        <AuthCard>
          <SignUpForm />
          <AuthCardSection className="border-t border-neutral-200">
            <div className="flex flex-col items-center justify-center gap-2 text-center text-sm md:flex-row md:flex-wrap md:justify-between md:text-left">
              <span className="text-neutral-600">{t('signUpHaveAccount')}</span>
              <Link className="font-semibold text-primary-500" href="/login">
                {t('signUpSignIn')}
              </Link>
            </div>
            <p className="mt-4 rounded-lg bg-neutral-100 px-4 py-3 text-center text-xs text-neutral-400">
              {t('signUpCovenant')}
            </p>
          </AuthCardSection>
        </AuthCard>
      }
    />
  )
}
