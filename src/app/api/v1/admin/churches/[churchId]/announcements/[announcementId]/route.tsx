import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { AnnouncementInputSchema, AnnouncementOutputSchema } from '@/models/announcement'
import { patchAnnouncement } from '@/controller/announcement'

/*
 * PATCH /api/v1/admin/churches/:churchId/announcements/:announcementId
 * (Task 27). version → 409 when stale.
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'announcementId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/announcements/:announcementId',
  method: 'patch',
  summary: 'Update an announcement',
  request: { params: paramsDecls, body: AnnouncementInputSchema },
  responses: [
    { status: 200, description: 'Updated announcement', schema: AnnouncementOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Announcement not found or out of scope' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; announcementId: string }> },
) {
  try {
    const { churchId, announcementId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(AnnouncementInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_announcement',
      action: 'update',
    })
    const result = await patchAnnouncement({
      userId: session.user.user_id,
      churchId,
      churchIds,
      announcementId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Announcement updated.')
  } catch (e) {
    return httpError(e)
  }
}
