import ContentsSiteHome from '@/contents/site/home'
import { getMyDonationOverview } from '@/controller/donation'
import { getMyHabits } from '@/controller/site-habits'
import { getHome } from '@/controller/mobile'
import { countSitePrayers } from '@/controller/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { stripAudioTags } from '@/utils/strip-audio-tags'
import { redirect } from 'next/navigation'

export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const userId = web.session.user.user_id
  const [home, giving, habits, readyPrayers] = await Promise.all([
    getHome({ userId }),
    getMyDonationOverview({ userId }),
    getMyHabits({ userId }),
    countSitePrayers({ userId }),
  ])
  // ElevenLabs audio tags stay in the shared/mobile payload; the website never shows them.
  const latestPrayers = home.latestPrayers.map((prayer) => ({
    ...prayer,
    version: {
      ...prayer.version,
      title: stripAudioTags(prayer.version.title),
      introduction: prayer.version.introduction && stripAudioTags(prayer.version.introduction),
      body: stripAudioTags(prayer.version.body),
    },
  }))
  return (
    <ContentsSiteHome
      gift={giving.activeGift}
      latestTransaction={giving.latestTransaction}
      nextGiftAt={giving.nextGiftAt}
      habits={habits}
      home={{ ...home, latestPrayers }}
      name={web.session.user.name}
      now={new Date().toISOString()}
      readyPrayers={readyPrayers}
    />
  )
}
