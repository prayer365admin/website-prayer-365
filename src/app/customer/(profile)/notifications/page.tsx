import { getNotificationPreferences } from '@/controller/mobile'
import requiredCustomer from '@/utils/required-customer'
import { redirect } from 'next/navigation'
import NotificationPreferences from '../_components/notification-preferences'

// Customer notification preferences (WB-17). The (profile) layout already
// redirects guests to /login and staff to the dashboard; the read is done here
// so the page never flashes empty switches while the client fetches.
export default async function Page() {
  const web = await requiredCustomer().catch(() => null)
  if (!web) redirect('/login')

  const initial = await getNotificationPreferences({ userId: web.session.user.user_id })

  return <NotificationPreferences initial={initial} />
}
