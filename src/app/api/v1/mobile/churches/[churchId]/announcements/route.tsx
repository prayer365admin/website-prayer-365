import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileChurchListQuerySchema, MobilePublicAnnouncementSchema } from '@/models/mobile'
import { listPublicAnnouncements } from '@/controller/mobile'

/*
 * GET /api/v1/mobile/churches/:churchId/announcements — published
 * announcements for an APPROVED church (SPEC §8.4 / Task 42). Only rows with
 * published_at set are served, newest first.
 */

registerPath({
  path: '/mobile/churches/:churchId/announcements',
  method: 'get',
  summary: 'Published announcements for an approved church',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'page', in: 'query', required: false, schema: z.string() },
      { name: 'limit', in: 'query', required: false, schema: z.string() },
    ],
  },
  responses: [
    { status: 200, description: 'Published announcements', schema: MobilePublicAnnouncementSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church not found or not approved' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    await requiredAuth(req)
    const { churchId } = await params
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listPublicAnnouncements({ churchId, query })
    return list(result as unknown[], total, query.page, query.limit, 'Announcements retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
