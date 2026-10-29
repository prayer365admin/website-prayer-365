import { GeneralError } from './general-error'
import { isCustomerRole } from './customer-role'
import requiredWebAuth from './required-webauth'

/**
 * Website guard for CUSTOMER-ONLY endpoints (plan 022).
 *
 * `requiredWebAuth` only proves "a live user", so a staff session used to be
 * treated as a customer: it was pushed into customer onboarding and its writes
 * created `user_churches` rows that the dashboard counts as church members.
 * Staff keep the public pages (home, directory, prayers, giving); only the
 * customer-only area and its writes are refused here.
 */
export default async function requiredCustomer() {
  const web = await requiredWebAuth()

  if (!isCustomerRole(web.session.user.role)) {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'STAFF_ACCOUNT',
      details: 'Staff accounts use the dashboard, not the customer website.',
    })
  }

  return web
}
