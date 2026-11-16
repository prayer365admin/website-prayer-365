import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { MobileCheckInTodaySchema } from '@/models/mobile'
import { getCheckInToday } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches/:churchId/check-ins/today — has the SIGNED-IN user already checked in at this
 * church on the church's current local day? Per-user answer (never cached/shared); same day rule and dedupe
 * key as POST check-ins. The mobile church page uses it so the "already checked in" state survives a reload.
 */

registerPath({
  path: '/mobile/churches/:churchId/check-ins/today',
  method: 'get',
  summary: "Today's check-in status of the signed-in user at an approved church",
  request: { params: [{ name: 'churchId', in: 'path', schema: z.string() }] },
  responses: [
    {
      status: 200,
      description: 'Check-in status for the church-local day',
      schema: MobileCheckInTodaySchema,
    },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { session } = await requiredAuth(req)
    const { churchId } = await params
    const result = await getCheckInToday({ userId: session.user.user_id, churchId })
    const response = ok(result, 'Check-in status.')
    // Per-user: no shared cache may keep it.
    response?.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch (e) {
    return httpError(e)
  }
}
