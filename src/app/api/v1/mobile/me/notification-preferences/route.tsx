import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileNotificationPreferencesSchema } from '@/models/mobile'
import { getNotificationPreferences, saveNotificationPreferences } from '@/controller/mobile'

/*
 * GET / PUT /api/v1/mobile/me/notification-preferences (MB-04).
 * Subject-only; six allowlisted keys; every type defaults ON (client decision
 * 2026-10-30) so a missing row is not "off".
 */

registerPath({
  path: '/mobile/me/notification-preferences',
  method: 'get',
  summary: 'Read the caller notification preferences (all types default on)',
  responses: [
    { status: 200, description: 'Preferences', schema: MobileNotificationPreferencesSchema },
    { status: 401, description: 'Not authenticated' },
  ],
})

registerPath({
  path: '/mobile/me/notification-preferences',
  method: 'put',
  summary: 'Save the caller notification preferences',
  request: { body: MobileNotificationPreferencesSchema },
  responses: [
    { status: 200, description: 'Saved preferences', schema: MobileNotificationPreferencesSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const prefs = await getNotificationPreferences({ userId: session.user.user_id })
    return ok(prefs, 'Preferences.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const body = validate(MobileNotificationPreferencesSchema, await req.json().catch(() => ({})))
    const prefs = await saveNotificationPreferences({
      userId: session.user.user_id,
      input: body,
      requestId: requestId(),
    })
    return ok(prefs, 'Preferences saved.')
  } catch (e) {
    return httpError(e)
  }
}
