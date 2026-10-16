import BoxContainer from '@/components/container/boxed'
import { MyActiveGift } from '@/models/donation'
import { MobileHome } from '@/models/mobile'
import DevotionalHero from './devotional-hero'
import UpcomingGatherings from './gatherings'
import SpiritualHabits from './habits'
import PrimaryParish from './parish'
import PrayerPetition from './petition'
import ScriptureOfDay from './scripture'
import HomeShortcuts from './shortcuts'
import { BrandQuote, Stewardship } from './stewardship'

export default function ContentsSiteHome({
  home,
  gift = null,
  name,
  now,
}: {
  home: MobileHome
  gift?: MyActiveGift | null
  name?: string | null
  now: string
}) {
  return (
    <BoxContainer containerClassName="py-6 md:py-8">
      <DevotionalHero name={name} now={now} prayer={home.latestPrayers[0]} />
      <HomeShortcuts />
      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,757.33fr)_minmax(0,362.67fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <PrimaryParish church={home.mainChurch} />
          <UpcomingGatherings events={home.latestEvents} timeZone={home.mainChurch?.timezone} />
          <ScriptureOfDay />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <SpiritualHabits followedChurches={home.followedChurches} mainChurch={home.mainChurch} />
          <PrayerPetition church={home.mainChurch} />
          <Stewardship gift={gift} />
          <BrandQuote />
        </div>
      </div>
    </BoxContainer>
  )
}
