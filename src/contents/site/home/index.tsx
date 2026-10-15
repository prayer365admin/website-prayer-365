import BoxContainer from '@/components/container/boxed'
import { MobileHome } from '@/models/mobile'
import DevotionalHero from './devotional-hero'

export default function ContentsSiteHome({
  home,
  name,
  now,
}: {
  home: MobileHome
  name?: string | null
  now: string
}) {
  return (
    <BoxContainer containerClassName="py-6 md:py-8">
      <DevotionalHero name={name} now={now} prayer={home.latestPrayers[0]} />
    </BoxContainer>
  )
}
