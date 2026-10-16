/**
 * Customer vs staff (WB1 / R-01, R-02). Public signup gives customers the
 * `prayer_user` role (no admin grants); older customers have no role at all.
 * Staff always hold a staff role. One email = one role.
 */
export const CUSTOMER_ROLE = 'prayer_user'

export const isCustomerRole = (role?: { name: string } | null) =>
  !role || role.name === CUSTOMER_ROLE
