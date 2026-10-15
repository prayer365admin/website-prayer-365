import ContentsSiteProfile from '@/contents/site/profile'
import { getMe, listMyChurches } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

// Customer profile (W13 / WB-16). Authorization and initial profile data are
// resolved on the server, so an unauthenticated or still-hydrating client never
// renders the profile's warning/error state during a direct load or refresh.
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const userId = web.session.user.user_id
  const me = await getMe({ userId })

  const churches = await listMyChurches({ userId })
  return <ContentsSiteProfile initialChurches={churches} initialMe={me} />
}
