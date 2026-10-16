import ContentsSiteHome from '@/contents/site/home'
import { getMyActiveGift } from '@/controller/donation'
import { getHome } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const userId = web.session.user.user_id
  const [home, gift] = await Promise.all([getHome({ userId }), getMyActiveGift({ userId })])
  return (
    <ContentsSiteHome
      gift={gift}
      home={home}
      name={web.session.user.name}
      now={new Date().toISOString()}
    />
  )
}
