import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  AnnouncementListItemSchema,
  AnnouncementListQuerySchema,
  AnnouncementStatusSchema,
} from '@/models/announcement'
import { listAnnouncements } from '@/controller/announcement'

/*
 * GET /api/v1/admin/central/announcements: read-only list across every church
 * the caller's central grant covers. Editing stays on the church route.
 */

registerPath({
  path: '/admin/central/announcements',
  method: 'get',
  summary: 'List announcements across churches',
  request: {
    params: [
      { name: 'page', in: 'query', required: false, schema: z.string() },
      { name: 'limit', in: 'query', required: false, schema: z.string() },
      { name: 'search', in: 'query', required: false, schema: z.string() },
      { name: 'status', in: 'query', required: false, schema: AnnouncementStatusSchema },
      { name: 'published_from', in: 'query', required: false, schema: z.string() },
      { name: 'published_to', in: 'query', required: false, schema: z.string() },
      {
        name: 'order_by',
        in: 'query',
        required: false,
        schema: z.enum(['created_at', 'title', 'published_at']),
      },
      { name: 'order_direction', in: 'query', required: false, schema: z.enum(['asc', 'desc']) },
    ],
  },
  responses: [
    { status: 200, description: 'Announcement list', schema: z.array(AnnouncementListItemSchema) },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const query = validate(
      AnnouncementListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    // ponytail: churchIds is every church under the root, passed as an IN list;
    // switch to an unfiltered central query if church count reaches the tens of thousands.
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_announcement',
      action: 'read',
    })
    const { result, total } = await listAnnouncements({ churchIds, query })
    return list(result as unknown[], total, query.page, query.limit, 'Announcements retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
