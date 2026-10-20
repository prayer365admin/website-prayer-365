import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'
import PersonalProfile from './_components/personal-profile'
import { getMeOnce } from './_data'

// Customer profile (W13 / WB-16). Authorization and initial profile data are
// resolved on the server, so an unauthenticated or still-hydrating client never
// renders the form with stale or empty data.
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const userId = web.session.user.user_id
  const me = await getMeOnce(userId)
  return <PersonalProfile emailVerified={Boolean(web.user.email_verified_at)} initialMe={me} />
}
