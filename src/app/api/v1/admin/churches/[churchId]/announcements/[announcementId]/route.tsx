import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  AnnouncementInputSchema,
  AnnouncementOutputSchema,
  AnnouncementPublishInputSchema,
} from '@/models/announcement'
import { deleteAnnouncement, patchAnnouncement } from '@/controller/announcement'

/*
 * PATCH/DELETE /api/v1/admin/churches/:churchId/announcements/:announcementId
 * (Task 27). version → 409 when stale. DELETE is a soft delete (deleted_at).
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

registerPath({
  path: '/admin/churches/:churchId/announcements/:announcementId',
  method: 'delete',
  summary: 'Soft-delete an announcement',
  request: { params: paramsDecls, body: AnnouncementPublishInputSchema },
  responses: [
    { status: 200, description: 'Announcement deleted' },
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; announcementId: string }> },
) {
  try {
    const { churchId, announcementId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(AnnouncementPublishInputSchema, await req.json().catch(() => ({})))
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_announcement',
      action: 'delete',
    })
    await deleteAnnouncement({
      userId: session.user.user_id,
      churchId,
      churchIds,
      announcementId,
      input,
      requestId: requestId(),
    })
    return ok(null, 'Announcement deleted.')
  } catch (e) {
    return httpError(e)
  }
}
