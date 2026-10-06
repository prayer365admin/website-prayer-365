import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, list, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import {
  AnnouncementInputSchema,
  AnnouncementListQuerySchema,
  AnnouncementOutputSchema,
  AnnouncementStatusSchema,
} from '@/models/announcement'
import { createAnnouncement, listAnnouncements } from '@/controller/announcement'

/*
 * GET/POST /api/v1/admin/churches/:churchId/announcements (Task 27, D12
 * minimal fields: title + body). POST saves unpublished; publish is a separate
 * immediate action.
 */

const churchIdParam = { name: 'churchId', in: 'path' as const, schema: z.string() }
const listQueryParams = [
  { name: 'page', in: 'query' as const, required: false, schema: z.string() },
  { name: 'limit', in: 'query' as const, required: false, schema: z.string() },
  { name: 'search', in: 'query' as const, required: false, schema: z.string() },
  { name: 'status', in: 'query' as const, required: false, schema: AnnouncementStatusSchema },
  { name: 'published_from', in: 'query' as const, required: false, schema: z.string() },
  { name: 'published_to', in: 'query' as const, required: false, schema: z.string() },
  {
    name: 'order_by',
    in: 'query' as const,
    required: false,
    schema: z.enum(['created_at', 'title', 'published_at']),
  },
  {
    name: 'order_direction',
    in: 'query' as const,
    required: false,
    schema: z.enum(['asc', 'desc']),
  },
]

registerPath({
  path: '/admin/churches/:churchId/announcements',
  method: 'post',
  summary: 'Create an announcement',
  request: { params: [churchIdParam], body: AnnouncementInputSchema },
  responses: [
    { status: 201, description: 'Created announcement', schema: AnnouncementOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Validation error' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/announcements',
  method: 'get',
  summary: 'List announcements',
  request: { params: [churchIdParam, ...listQueryParams] },
  responses: [
    { status: 200, description: 'Announcement list', schema: AnnouncementOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const query = validate(
      AnnouncementListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_announcement',
      action: 'read',
    })
    const { result, total } = await listAnnouncements({ churchIds, query })
    return list(result as unknown[], total, query.page, query.limit, 'Announcements retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string }> },
) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(AnnouncementInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_announcement',
      action: 'create',
    })
    const result = await createAnnouncement({
      userId: session.user.user_id,
      churchId,
      churchIds,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Announcement created.', 201)
  } catch (e) {
    return httpError(e)
  }
}
