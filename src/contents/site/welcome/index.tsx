'use client'

import SiteTopBar from '@/components/site/top-bar'
import { GeneralPrayerSiteOutput } from '@/models/general-prayer'
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
 * Client component so the copy follows the locale switcher immediately: every section
 * reads `useSiteI18n()`. Server data (featured prayer, member count) is fetched by the
 * route page and passed down as props.
 */
export default function ContentsSiteWelcome({
  memberCount = null,
  prayer = null,
  dailyPrayer = null,
  dailyDate = null,
}: {
  memberCount?: number | null
  prayer?: SiteLoginPrayer | null
  /** Today's platform prayer: it fills the hero's listening card for a visitor. */
  dailyPrayer?: GeneralPrayerSiteOutput | null
  /** `13.11.2026` — the day the daily prayer belongs to. */
  dailyDate?: string | null
}) {
  return (
    <div className="min-h-screen bg-[#F5F7FF] text-[#191C1E] font-font_heading flex flex-col justify-between selection:bg-[#2F7AD2] selection:text-white">
      <SiteTopBar />
      <main className="flex-1">
        <WelcomeHero
          dailyDate={dailyDate}
          dailyPrayer={dailyPrayer}
          memberCount={memberCount}
          prayer={prayer}
        />
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
