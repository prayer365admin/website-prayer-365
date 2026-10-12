import { auth } from '@/auth'
import { GeneralError } from './general-error'
import { getAccessPermission } from './access-permission'
import { verifyAccessToken } from './jwt-token'
import { GET_USER_BY_ID } from '@/providers/user'
import { NextRequest } from 'next/server'

export default async function requiredAuth(req?: NextRequest) {
  let session = await auth()

  // Mobile/API clients: no cookie → accept Authorization: Bearer ***
  if (!session && req) {
    const bearer = req.headers.get('authorization')
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
    const payload = token ? await verifyAccessToken(token) : null

    // Mobile access tokens carry `auth_version`; re-validate against the live
    // user at every authorization boundary — reject disabled/missing users and
    // tokens minted before a password change / account disable.
    if (payload) {
      if (payload.auth_version !== undefined) {
        const user = await GET_USER_BY_ID({ user_id: payload.user_id })
        const active =
          user && user.status === 'active' && user.auth_version === payload.auth_version
        if (!active) {
          throw new GeneralError({
            error: 'Not Authenticated!',
            error_code: 'UNAUTHORIZED',
            details: 'Please login and try again!',
            code: 401,
          })
        }
      }
      session = {
        expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: {
          user_id: payload.user_id,
          email: payload.email,
          name: payload.name ?? null,
          auth_version: payload.auth_version ?? 0,
          role: payload.role,
        },
      }
    }
  }

  if (!session) {
    throw new GeneralError({
      error: 'Not Authenticated!',
      error_code: 'UNAUTHORIZED',
      details: 'Please login and try again!',
      code: 401,
    })
  }

  const accessPermission = await getAccessPermission()
  // Role-less sessions (website customers, role-less mobile bearers) get an
  // empty role name: every permission check is denied, nothing is granted.
  const permission = accessPermission.can(session.user.role?.name ?? '')

  return {
    session,
    permission,
  }
}
