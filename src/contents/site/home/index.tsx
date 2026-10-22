import BoxContainer from '@/components/container/boxed'
import { MyActiveGift } from '@/models/donation'
import { SiteHabits } from '@/models/site-habits'
import { MobileHome } from '@/models/mobile'
import DevotionalHero from './devotional-hero'
import UpcomingGatherings from './gatherings'
import SpiritualHabits from './habits'
import PrimaryParish from './parish'
import PrayerPetition from './petition'
import ScriptureOfDay from './scripture'
import HomeShortcuts from './shortcuts'
import { BrandQuote, Stewardship } from './stewardship'

// Temporarily hide website event and announcement UI without removing its implementation.
const SHOW_EVENTS_AND_ANNOUNCEMENTS = false
const SHOW_PRAYER_PETITION = false

export default function ContentsSiteHome({
  home,
  gift = null,
  nextGiftAt = null,
  habits = { streakDays: 0, minutesThisWeek: 0 },
  name,
  now,
  userId,
  readyPrayers = 0,
}: {
  home: MobileHome
  gift?: MyActiveGift | null
  nextGiftAt?: Date | null
  habits?: SiteHabits
  name?: string | null
  now: string
  userId: string
  readyPrayers?: number
}) {
  return (
    <BoxContainer containerClassName="py-6 md:py-8">
      <DevotionalHero name={name} now={now} prayer={home.latestPrayers[0]} userId={userId} />
      <HomeShortcuts readyPrayers={readyPrayers} />
      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,757.33fr)_minmax(0,362.67fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <PrimaryParish church={home.mainChurch} />
          {SHOW_EVENTS_AND_ANNOUNCEMENTS && (
            <UpcomingGatherings events={home.latestEvents} timeZone={home.mainChurch?.timezone} />
          )}
          <ScriptureOfDay />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <SpiritualHabits
            followedChurches={home.followedChurches}
            habits={habits}
            mainChurch={home.mainChurch}
          />
          {SHOW_PRAYER_PETITION && <PrayerPetition church={home.mainChurch} />}
          <Stewardship churchId={home.mainChurch?.id ?? null} gift={gift} nextGiftAt={nextGiftAt} />
          <BrandQuote />
        </div>
      </div>
    </BoxContainer>
  )
}
