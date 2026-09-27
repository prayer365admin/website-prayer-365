import { auth } from '@/auth'
import { GeneralError } from './general-error'
import { getAccessPermission } from './access-permission'
import { verifyAccessToken } from './jwt-token'
import { NextRequest } from 'next/server'

export default async function requiredAuth(req?: NextRequest) {
  let session = await auth()

  // Mobile/API clients: no cookie → accept Authorization: Bearer <token>
  if (!session && req) {
    const bearer = req.headers.get('authorization')
    const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
    const payload = token ? await verifyAccessToken(token) : null

    if (payload) {
      session = {
        expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        user: {
          user_id: payload.user_id,
          email: payload.email,
          name: payload.name ?? null,
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
  const permission = accessPermission.can(session.user.role.name)

  return {
    session,
    permission,
  }
}
