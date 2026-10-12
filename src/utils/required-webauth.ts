import { auth } from '@/auth'
import { GET_USER_BY_ID } from '@/providers/user'
import { GeneralError } from './general-error'

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

  const user = await GET_USER_BY_ID({ user_id: session.user.user_id })
  const active = user && user.status === 'active' && user.auth_version === session.user.auth_version

  if (!active) {
    throw unauthorized()
  }

  return { session, user }
}
