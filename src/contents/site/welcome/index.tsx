import SiteTopBar from '@/components/site/top-bar'
import { SiteLocale } from '@/config/site-locale'
import { siteT } from '@/i18n/messages'
import { SiteLoginPrayer } from '@/models/site-prayer'
import WelcomeAppPromo from './app-promo'
import WelcomeCommunity from './community'
import WelcomeCtaParishioner from './cta-parishioner'
import WelcomeFooter from './footer'
import WelcomeHero from './hero'
import WelcomePillars from './pillars'
import WelcomeScriptureQuote from './scripture-quote'
import WelcomeStatsStrip from './stats-strip'
import WelcomeTestimonials from './testimonials'

/**
 * Public welcome marketing landing page (/welcome per Figma design node 87-8752).
 *
 * Composed as a fast server component. Audio player and interactive widgets hydrate on the client.
 */
export default function ContentsSiteWelcome({
  locale = 'en',
  memberCount = null,
  prayer = null,
}: {
  locale?: SiteLocale
  memberCount?: number | null
  prayer?: SiteLoginPrayer | null
}) {
  const t = siteT(locale)

  return (
    <div className="min-h-screen bg-[#F5F7FF] text-[#191C1E] font-font_heading flex flex-col justify-between selection:bg-[#2F7AD2] selection:text-white">
      <SiteTopBar variant="general" />
      <main className="flex-1">
        <WelcomeHero locale={locale} memberCount={memberCount} prayer={prayer} t={t} />
        <WelcomeStatsStrip />
        <WelcomePillars />
        <WelcomeCommunity />
        <WelcomeAppPromo />
        <WelcomeCtaParishioner />
        <WelcomeTestimonials />
        <WelcomeScriptureQuote />
      </main>
      <WelcomeFooter />
    </div>
  )
}
