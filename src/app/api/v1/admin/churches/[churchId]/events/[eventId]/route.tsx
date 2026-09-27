import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { EventInputSchema, EventOutputSchema } from '@/models/event'
import { patchEvent } from '@/controller/event'

/*
 * PATCH /api/v1/admin/churches/:churchId/events/:eventId (Task 26).
 * version → 409 when stale; must belong to this church (403/404).
 */

const paramsDecls = [
  { name: 'churchId', in: 'path' as const, schema: z.string() },
  { name: 'eventId', in: 'path' as const, schema: z.string() },
]

registerPath({
  path: '/admin/churches/:churchId/events/:eventId',
  method: 'patch',
  summary: 'Update an event',
  request: { params: paramsDecls, body: EventInputSchema },
  responses: [
    { status: 200, description: 'Updated event', schema: EventOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Event not found or out of scope' },
    { status: 409, description: 'Stale version' },
    { status: 422, description: 'Validation error' },
  ],
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ churchId: string; eventId: string }> },
) {
  try {
    const { churchId, eventId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(EventInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_event',
      action: 'update',
    })
    const result = await patchEvent({
      userId: session.user.user_id,
      churchId,
      churchIds,
      eventId,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Event updated.')
  } catch (e) {
    return httpError(e)
  }
}
