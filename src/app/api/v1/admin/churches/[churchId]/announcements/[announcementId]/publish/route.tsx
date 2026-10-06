import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { AnnouncementOutputSchema, AnnouncementPublishInputSchema } from '@/models/announcement'
import { publishAnnouncement } from '@/controller/announcement'

/*
 * POST /api/v1/admin/churches/:churchId/announcements/:announcementId/publish
 * (Task 27). Immediate publication: published_at = now. No arbitrary schedule.
 * version → 409 when stale.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'announcementId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/announcements/:announcementId/publish',
  method: 'post',
  summary: 'Publish an announcement immediately',
  request: { params: paramsDecls, body: AnnouncementPublishInputSchema },
  responses: [
    { status: 200, description: 'Published announcement', schema: AnnouncementOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Announcement not found or out of scope' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; announcementId: string }> },
) {
  try {
    const { churchId, announcementId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(AnnouncementPublishInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_announcement_publication',
      action: 'update',
    })
    const result = await publishAnnouncement({
      userId: session.user.user_id,
      churchId,
      churchIds,
      announcementId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Announcement published.')
  } catch (e) {
    return httpError(e)
  }
}
