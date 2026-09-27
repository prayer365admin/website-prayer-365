import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { ServiceTimeEntryOutputSchema, ServiceTimeScheduleInputSchema } from '@/models/service-time'
import { getServiceTimes, replaceServiceTimes } from '@/controller/service-time'

/*
 * GET/PUT /api/v1/admin/churches/:churchId/service-times (SPEC §8.2 / Task 14).
 * PATCH replaces the weekly schedule transactionally, gated by the church
 * version (409 when stale). Weekday 1-7; localTime HH:MM(:SS).
 */

const churchIdParam = { name: 'churchId', in: 'path' as const, schema: z.string() }

registerPath({
  path: '/admin/churches/:churchId/service-times',
  method: 'get',
  summary: 'Get weekly service schedule',
  request: { params: [churchIdParam] },
  responses: [
    {
      status: 200,
      description: 'Weekly schedule',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: z.array(ServiceTimeEntryOutputSchema),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
  ],
})

registerPath({
  path: '/admin/churches/:churchId/service-times',
  method: 'put',
  summary: 'Replace weekly service schedule',
  request: { params: [churchIdParam], body: ServiceTimeScheduleInputSchema },
  responses: [
    {
      status: 200,
      description: 'Replaced schedule count',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: z.object({ count: z.number() }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 409, description: 'Stale version conflict' },
    { status: 422, description: 'Validation error (weekday/time)' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_church',
      action: 'read',
    })
    const result = await getServiceTimes({ churchIds })
    return ok(result, 'Service times retrieved.')
  } catch (e) {
    return httpError(e)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const { session } = await requiredAuth(req)
    const input = validate(ServiceTimeScheduleInputSchema, await req.json())
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      churchId,
      subject: 'prayer_church',
      action: 'update',
    })
    const result = await replaceServiceTimes({
      userId: session.user.user_id,
      churchId,
      churchIds,
      input,
      requestId: requestId(),
    })
    return ok(result, 'Service times updated.')
  } catch (e) {
    return httpError(e)
  }
}
