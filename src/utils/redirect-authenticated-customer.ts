import { isCustomerRole } from '@/utils/customer-role'
import requiredWebAuth from '@/utils/required-webauth'
import { SITE_HOME } from '@/utils/constant'
import { redirect } from 'next/navigation'

/** Server-only guest-page guard for the customer login and registration routes. */
export default async function redirectAuthenticatedCustomer() {
  // Invalid, expired, disabled and auth-version-stale sessions are guests and
  // must retain access to the authentication pages.
  const web = await requiredWebAuth().catch(() => null)
  // Same landing as sign-in (WB-11): a signed-in customer belongs on the home
  // page, not on the guest pages or the profile page.
  if (web && isCustomerRole(web.session.user.role)) redirect(SITE_HOME)
}
