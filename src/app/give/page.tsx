import type { Metadata } from 'next'
import SiteShell from '@/components/site'
import {
  PLATFORM_DONATION_CURRENCY,
  PLATFORM_DONATION_PRESETS_MINOR,
  PLATFORM_GIVE_PATH,
} from '@/config/platform-church'
import { SITE_DESCRIPTION, SITE_NAME } from '@/config/site-brand'
import ContentsSiteGive from '@/contents/site/give'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { isStripeEnabled } from '@/providers/stripe'
import { firstParam } from '@/utils/search-param'
import { getSiteLocale } from '@/utils/site-locale'

/** Head tags follow the UI language; the site description stays site-wide. */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getSiteLocale()
  return {
    title: { absolute: `${SITE_MESSAGES[locale].publicGiveTitle} — ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    alternates: { canonical: PLATFORM_GIVE_PATH },
  }
}

/**
 * Public giving (PD-UI-01). Lives OUTSIDE the `(site)` group on purpose: that
 * layout requires a web session and would bounce every visitor to `/welcome`.
 * No session, no database read — a visitor without an account is exactly who
 * this page is for, and the gift always goes to the platform (D-02).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const locale = await getSiteLocale()
  const canceled = firstParam(params.canceled) === '1'

  return (
    <SiteI18nProvider initialLocale={locale}>
      <SiteShell footerVariant="full" headerVariant="auth">
        <ContentsSiteGive
          canceled={canceled}
          currency={PLATFORM_DONATION_CURRENCY}
          presetsMinor={PLATFORM_DONATION_PRESETS_MINOR}
          stripeReady={isStripeEnabled()}
        />
      </SiteShell>
    </SiteI18nProvider>
  )
}
