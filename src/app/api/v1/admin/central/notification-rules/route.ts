import { NextRequest } from 'next/server'
import { z } from 'zod'
import { listNotificationRules, updateNotificationRules } from '@/controller/notification'
import { NotificationRulesUpdateSchema } from '@/models/notification'
import { registerPath } from '@/utils/openapi'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { httpError, ok, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'

const RecurrenceSchema = z.union([z.enum(['weekly', 'monthly']), z.null()])

const RuleDtoSchema = z.object({
  id: z.string(),
  type: z.string(),
  enabled: z.boolean(),
  push_enabled: z.boolean(),
  email_enabled: z.boolean(),
  offset_minutes: z.number().nullable(),
  recurrence: RecurrenceSchema,
  version: z.number(),
})

registerPath({
  path: '/admin/central/notification-rules',
  method: 'get',
  summary: 'List configured notification rules',
  responses: [
    { status: 200, description: 'Configured notification rules', schema: z.array(RuleDtoSchema) },
  ],
})

registerPath({
  path: '/admin/central/notification-rules',
  method: 'put',
  summary: 'Update notification rules (allowed types only, allowlisted offsets)',
  request: {
    body: z.array(
      z.object({
        type: z.string(),
        version: z.number(),
        enabled: z.boolean().optional(),
        push_enabled: z.boolean().optional(),
        email_enabled: z.boolean().optional(),
        offset_minutes: z.number().nullable().optional(),
        recurrence: RecurrenceSchema.optional(),
      }),
    ),
  },
  responses: [
    {
      status: 200,
      description: 'Updated notification rules',
      schema: z.array(RuleDtoSchema),
    },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_notification_rule',
      action: 'read',
    })
    const rules = await listNotificationRules()
    return ok(rules, 'Successfully fetched notification rules')
  } catch (e) {
    return httpError(e)
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const actorId = session.user.user_id
    await requiredScope({
      userId: actorId,
      central: true,
      subject: 'prayer_notification_rule',
      action: 'update',
    })
    const body = await req.json().catch(() => ({}))
    const payload = validate(NotificationRulesUpdateSchema, body)
    const rules = await updateNotificationRules({
      items: payload,
      actorId,
      requestId: genRequestId(),
    })
    return ok(rules, 'Notification rules updated', 200)
  } catch (e) {
    return httpError(e)
  }
}
