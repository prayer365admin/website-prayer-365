import { Prisma } from '@prisma/client'

/**
 * Customer vs staff (WB1 / R-01, R-02). Public signup gives customers the
 * `prayer_user` role (no admin grants); older customers have no role at all.
 * Staff always hold a staff role. One email = one role.
 */
export const CUSTOMER_ROLE = 'prayer_user'

export const isCustomerRole = (role?: { name: string } | null) =>
  !role || role.name === CUSTOMER_ROLE

/**
 * User filter for "this account is a real customer" — the ONE definition every
 * customer-count uses (fellowship count, church member count, follower ranking).
 * Staff live in the same `users` table and must never inflate a customer number,
 * e.g. when an admin picks a parish on the website.
 */
export const CUSTOMER_ACCOUNT_FILTER: Prisma.UserWhereInput = {
  // Only live accounts count: a customer whose deletion is pending (or finished) is not a member.
  status: 'active',
  OR: [{ role_id: null }, { role: { is: { name: CUSTOMER_ROLE } } }],
}

/**
 * Push/email audience: ACTIVE CUSTOMERS only (D-GP-12). Role assignments supersede the legacy
 * `role_id`, so an account carrying any live non-customer grant is excluded too. Shared by the
 * daily-prayer fan-out and the church notification recipients so "customer only" is ONE rule.
 */
export const ACTIVE_CUSTOMER_WHERE: Prisma.UserWhereInput = {
  status: 'active',
  deleted_at: null,
  role: { is: { name: CUSTOMER_ROLE } },
  roleAssignments: {
    none: { revoked_at: null, role: { is: { name: { not: CUSTOMER_ROLE } } } },
  },
}
