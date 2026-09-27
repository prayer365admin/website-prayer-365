import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { VoiceProfileListItemSchema, VoiceProfileListQuerySchema } from '@/models/voice'
import { listCentralProfiles } from '@/controller/voice'

/*
 * GET /api/v1/admin/central/voice-profiles (Task 37).
 * prayer_voice_profile:read. Authorized review list with registration state.
 * NEVER exposes provider_voice_id / provider secrets.
 */

const querySchema = VoiceProfileListQuerySchema

registerPath({
  path: '/admin/central/voice-profiles',
  method: 'get',
  summary: 'Review voice profiles with registration state',
  request: {
    params: [
      { name: 'page', in: 'query' as const, schema: querySchema.shape.page },
      { name: 'limit', in: 'query' as const, schema: querySchema.shape.limit },
      { name: 'order_by', in: 'query' as const, schema: querySchema.shape.order_by },
      { name: 'order_direction', in: 'query' as const, schema: querySchema.shape.order_direction },
      { name: 'review_state', in: 'query' as const, schema: querySchema.shape.review_state },
      {
        name: 'registration_state',
        in: 'query' as const,
        schema: querySchema.shape.registration_state,
      },
      { name: 'churchId', in: 'query' as const, schema: querySchema.shape.churchId },
    ],
  },
  responses: [
    { status: 200, description: 'Voice profiles', schema: VoiceProfileListItemSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed (voice review permission required)' },
  ],
})

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_voice_profile',
      action: 'read',
    })
    const query = validate(querySchema, Object.fromEntries(req.nextUrl.searchParams))
    const result = await listCentralProfiles({ query })
    return list(result.result, result.total, query.page, query.limit, 'Voice profiles.')
  } catch (e) {
    return httpError(e)
  }
}
