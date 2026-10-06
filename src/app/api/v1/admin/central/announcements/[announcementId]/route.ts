import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { AnnouncementListItemSchema } from '@/models/announcement'
import { getAnnouncementInScope } from '@/controller/announcement'

/*
 * GET /api/v1/admin/central/announcements/:announcementId: one announcement
 * with its church, resolved without knowing the church up front. Mutations
 * go through the church-scoped announcement routes using the returned churchId.
 */

registerPath({
  path: '/admin/central/announcements/:announcementId',
  method: 'get',
  summary: 'Get an announcement across churches',
  request: { params: [{ name: 'announcementId', in: 'path', schema: z.string() }] },
  responses: [
    { status: 200, description: 'Announcement', schema: AnnouncementListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Announcement not found or out of scope' },
  ],
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  try {
    const { announcementId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_announcement',
      action: 'read',
    })
    const result = await getAnnouncementInScope({ churchIds, announcementId })
    return ok(result, 'Announcement retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
