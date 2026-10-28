import { isCustomerRole } from '@/utils/customer-role'
import requiredWebAuth from '@/utils/required-webauth'
import { redirect } from 'next/navigation'

/** Server-only guest-page guard for the staff /admin/login route. */
export default async function redirectAuthenticatedStaff() {
  const web = await requiredWebAuth().catch(() => null)
  // A signed-in staff member has no business on the sign-in page.
  if (web && !isCustomerRole(web.session.user.role)) redirect('/dashboard')
}
