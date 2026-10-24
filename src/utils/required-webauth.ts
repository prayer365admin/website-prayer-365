import { auth } from '@/auth'
import { GET_USER_BY_ID } from '@/providers/user'
import { cache } from 'react'
import { GeneralError } from './general-error'

/**
 * One live-user read per request. The `(site)` layout and the page inside it both
 * revalidate, and React's request-scoped cache collapses them into a single DB
 * query (outside a React render, e.g. an API route, it simply calls through).
 */
const getUserOnce = cache((userId: string) => GET_USER_BY_ID({ user_id: userId }))

/**
 * Website (customer) session guard — SPEC §2.2 / §9.
 *
 * Cookie session only: the website never calls the bearer-gated
 * `/api/v1/mobile/*` endpoints, so there is no Authorization branch here.
 * The live user is revalidated on every protected call (status active +
 * matching auth_version), same rule as requiredAuth.
 *
 * Returns NO permission object: customers are role-less by design (WF1), so
 * every website read is scoped by the session user id, never by a role grant.
 */
export default async function requiredWebAuth() {
  const unauthorized = () =>
    new GeneralError({
      error: 'Not Authenticated!',
      error_code: 'UNAUTHORIZED',
      details: 'Please login and try again!',
      code: 401,
    })

  const session = await auth()
  if (!session?.user?.user_id) {
    throw unauthorized()
  }

  const user = await getUserOnce(session.user.user_id)
  const active = user && user.status === 'active' && user.auth_version === session.user.auth_version

  if (!active) {
    throw unauthorized()
  }

  return { session, user }
}
