import { NextRequest } from 'next/server'
import { recordAnalyticsEvents } from '@/controller/mobile'
import { MobileAnalyticsInputSchema } from '@/models/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { revalidatePath } from 'next/cache'

/*
 * POST /api/v1/site/analytics-events — cookie-session twin of the mobile route.
 * Same allowlist, batch limit and subject-only recording (user from the session).
 */
export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const input = validate(MobileAnalyticsInputSchema, await req.json())
    const result = await recordAnalyticsEvents({
      userId: session.user.user_id,
      input,
      requestId: requestId(),
    })
    if (
      input.events.some(
        ({ eventType }) => eventType === 'prayer_listen' || eventType === 'prayer_listen_minute',
      )
    ) {
      revalidatePath('/')
    }
    return ok(result, 'Analytics recorded.')
  } catch (e) {
    return httpError(e)
  }
}
