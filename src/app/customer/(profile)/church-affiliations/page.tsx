import { listMyChurches } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'
import ChurchAffiliations from '../_components/church-affiliations'
import { getMeOnce } from '../_data'

export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const userId = web.session.user.user_id
  const [me, churches] = await Promise.all([getMeOnce(userId), listMyChurches({ userId })])

  return <ChurchAffiliations initialChurches={churches} initialMe={me} />
}
