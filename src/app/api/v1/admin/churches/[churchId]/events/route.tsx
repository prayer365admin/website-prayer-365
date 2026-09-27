import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, list, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { EventInputSchema, EventListQuerySchema, EventOutputSchema } from '@/models/event'
import { createEvent, listEvents } from '@/controller/event'

/*
 * GET/POST /api/v1/admin/churches/:churchId/events (Task 26). category is the
 * fixed enum; startsAt must be a UTC ISO datetime (no ambiguous offset);
 * registrationUrl is https-only; language must exist. Church-owned, scoped.
 */

const churchIdParam = { name: 'churchId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/churches/:churchId/events',
  method: 'post',
  summary: 'Create a church event',
  request: { params: [churchIdParam], body: EventInputSchema },
  responses: [
    { status: 201, description: 'Created event', schema: EventOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Validation error (category/date/url/language)' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/events',
  method: 'get',
  summary: 'List church events',
  request: { params: [churchIdParam] },
  responses: [
    { status: 200, description: 'Event list', schema: EventOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const query = validate(EventListQuerySchema, Object.fromEntries(req.nextUrl.searchParams))
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_event',
      action: 'read',
    })
    const { result, total } = await listEvents({ churchIds, query })
    return list(result as unknown[], total, query.page, query.limit, 'Events retrieved.')
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
    const input = validate(EventInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_event',
      action: 'create',
    })
    const result = await createEvent({
      userId: session.user.user_id,
      churchId,
      churchIds,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Event created.', 201)
  } catch (e) {
    return httpError(e)
  }
}
