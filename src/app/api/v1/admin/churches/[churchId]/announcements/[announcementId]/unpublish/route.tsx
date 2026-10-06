import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { AnnouncementOutputSchema, AnnouncementPublishInputSchema } from '@/models/announcement'
import { unpublishAnnouncement } from '@/controller/announcement'

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'announcementId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/announcements/:announcementId/unpublish',
  method: 'post',
  summary: 'Return a published announcement to draft',
  request: { params: paramsDecls, body: AnnouncementPublishInputSchema },
  responses: [
    { status: 200, description: 'Announcement unpublished', schema: AnnouncementOutputSchema },
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
    const result = await unpublishAnnouncement({
      userId: session.user.user_id,
      churchId,
      churchIds,
      announcementId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Announcement unpublished.')
  } catch (e) {
    return httpError(e)
  }
}
