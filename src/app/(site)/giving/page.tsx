import { listMyChurches } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

/**
 * Bare `/giving` entry (header/footer link, WB-09/WB-41). A gift is always made
 * to one parish, so this resolves the giver's own main parish and hands off to
 * its donate page; without one there is nowhere honest to send them.
 */
export default async function Page() {
  const web = await requiredWebAuth().catch(() => null)
  if (!web) redirect('/login')

  const churches = await listMyChurches({ userId: web.session.user.user_id })
  const main = churches.find((row) => row.isMain) ?? null
  redirect(main ? `/donate/${main.churchId}` : '/churches')
}
