import ContentsSiteHome from '@/contents/site/home'
import { getHome } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const home = await getHome({ userId: web.session.user.user_id })
  return (
    <ContentsSiteHome home={home} name={web.session.user.name} now={new Date().toISOString()} />
  )
}
