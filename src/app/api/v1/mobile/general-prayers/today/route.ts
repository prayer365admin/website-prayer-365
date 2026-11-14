import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'
import { noStore, ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobileGeneralPrayerSchema } from '@/models/general-prayer'
import { getMobileGeneralPrayer } from '@/controller/general-prayer'
import { todayInTallinn } from '@/utils/general-prayer-cycle'

/*
 * GET /api/v1/mobile/general-prayers/today — the platform 365-day daily prayer
 * for today (Europe/Tallinn), GP-MOB-01. Church-independent content, so it is
 * readable WITHOUT a session: a guest's home screen leads with this prayer
 * (client note, 13 Nov 2026) and the website page is public too (D-GP-7).
 * The `no-store` header stops a CDN from serving yesterday's prayer.
 * No active content -> 404.
 */

registerPath({
  path: '/mobile/general-prayers/today',
  method: 'get',
  summary: "Today's platform daily prayer (365-day cycle)",
  responses: [
    { status: 200, description: "Today's prayer payload", schema: MobileGeneralPrayerSchema },
    { status: 404, description: 'No active content for today' },
  ],
})

export async function GET(_req: NextRequest) {
  try {
    const { dateISO } = todayInTallinn()
    const result = await getMobileGeneralPrayer({ dateISO })
    if (!result) {
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'No active daily prayer for today.',
      })
    }
    return noStore(ok(result, 'Daily prayer retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
