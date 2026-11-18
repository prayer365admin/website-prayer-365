import { NextRequest } from 'next/server'
import { getNotificationPreferences, saveNotificationPreferences } from '@/controller/mobile'
import { MobileNotificationPreferencesSchema } from '@/models/mobile'
import requiredCustomer from '@/utils/required-customer'
import { httpError, ok, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'

/*
 * GET / PUT /api/v1/site/me/notification-preferences (WB-17).
 *
 * Website twin of the mobile route: same controller, same six keys, cookie
 * session, subject-only, customer-only (a staff session gets 403 STAFF_ACCOUNT).
 * A missing row reads as ON, so this page shows exactly the truth the
 * daily-prayer sender uses.
 */

export async function GET() {
  try {
    const { session } = await requiredCustomer()
    const prefs = await getNotificationPreferences({ userId: session.user.user_id })
    return ok(prefs, 'Preferences.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { session } = await requiredCustomer()
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
