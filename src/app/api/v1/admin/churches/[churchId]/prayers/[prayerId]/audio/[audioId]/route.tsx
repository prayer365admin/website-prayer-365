import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { PrayerAudioOutputSchema } from '@/models/prayer'
import { getAudio } from '@/controller/prayer-audio'

/*
 * GET /api/v1/admin/churches/:churchId/prayers/:prayerId/audio/:audioId
 * (Task 23). Returns generation state + preview info, scoped to this church
 * and prayer. Cross-church audio is hidden (404).
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'prayerId', in: 'path' as const, schema: z.string() },
  { name: 'audioId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/prayers/:prayerId/audio/:audioId',
  method: 'get',
  summary: 'Get audio generation state and preview info',
  request: { params: paramsDecls },
  responses: [
    { status: 200, description: 'Audio state', schema: PrayerAudioOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Audio not found or out of scope' },
  ],
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; prayerId: string; audioId: string }> },
) {
  try {
    const { churchId, prayerId, audioId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_prayer',
      action: 'read',
    })
    const result = await getAudio({ churchIds, prayerId, audioId })
    return ok(result, 'Audio retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
