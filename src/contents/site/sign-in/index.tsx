import SiteButton from '@/components/common/button'
import { ArrowRightIcon } from '@/components/icon/arrow-right'
import { ChurchIcon } from '@/components/icon/church'
import { MailIcon } from '@/components/icon/mail'
import { StarsIcon } from '@/components/icon/stars'
import { AuthCard, AuthCardSection } from '@/components/site/auth/auth-card'
import AuthLayout from '@/components/site/auth/auth-layout'
import Pill from '@/components/site/auth/pill'
import ScriptureQuote from '@/components/site/auth/scripture-quote'
import SignInAside from '@/components/site/auth/sign-in-aside'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import Link from 'next/link'
import SignInForm from './form'

/*
 * Customer sign-in (W01 / WB-11), design: docs/website/design/wb1/page-sign-in.png.
 * Email + password only. "Member ID", "Keep me signed in", ChurchID (EELK) and
 * Magic Link are UI only (decisions B4/F1, REPORT R-04).
 *
 * Server component: everything static renders as HTML with no client JS;
 * only <SignInForm /> hydrates (keeps Total Blocking Time low).
 */
export default function ContentsSiteSignIn({ locale }: { locale: SiteLocale }) {
  const t = siteT(locale)

  return (
    <AuthLayout
      aside={<SignInAside t={t} />}
      form={
        <AuthCard>
          <AuthCardSection>
            <div className="flex items-center justify-between gap-2">
              <Pill icon={<StarsIcon aria-hidden />}>{t('signInPortal')}</Pill>
              <span className="text-sm text-blue-800">{t('signInSession')}</span>
            </div>
            <h1 className="mt-4 font-font_heading text-2xl font-bold tracking-tight text-primary-900 md:text-[32px]">
              {t('signInTitle')}
            </h1>
            <p className="mt-2 text-neutral-600">{t('signInSubtitle')}</p>
          </AuthCardSection>
          <AuthCardSection className="md:pt-0">
            <ScriptureQuote quote={t('signInQuote')} reference={t('signInQuoteRef')} />
          </AuthCardSection>

          <AuthCardSection className="md:pt-0">
            <SignInForm />
          </AuthCardSection>

          {/* Not a section: the lines run edge to edge of the card. */}
          <div className="flex items-center gap-4 py-1">
            <span aria-hidden className="h-px flex-1 bg-neutral-100" />
            <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-neutral-500">
              {t('signInAltDivider')}
            </span>
            <span aria-hidden className="h-px flex-1 bg-neutral-100" />
          </div>

          {/* UI only until ChurchID / magic-link sign-in exist (REPORT R-04). */}
          <AuthCardSection className="pt-4 md:pt-4 grid gap-4 sm:grid-cols-2">
            <SiteButton
              className="w-full"
              icon={<ChurchIcon aria-hidden />}
              size="sm"
              variant="outlined"
            >
              {t('signInChurchId')}
            </SiteButton>
            <SiteButton
              className="w-full"
              icon={<MailIcon aria-hidden />}
              size="sm"
              variant="outlined"
            >
              {t('signInMagicLink')}
            </SiteButton>
          </AuthCardSection>

          <AuthCardSection className="border-t text-sm border-neutral-100 text-center text-neutral-600">
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
