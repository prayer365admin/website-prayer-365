import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { httpError, list as listResponse, noStore } from '@/utils/response'
import { validate } from '@/utils/validate'
import { parseListQuery } from '@/utils/pagination'
import { registerPath } from '@/utils/openapi'
import {
  RequestKindsParamSchema,
  RequestKindsQuerySchema,
  RequestListFilterSchema,
  RequestListSummarySchema,
} from '@/models/request'
import { resolveRequestReadScope, listRequests } from '@/controller/request'

/*
 * GET /api/v1/admin/churches/:churchId/requests (SPEC §8.2 / Task 28).
 *
 * Standard reader needs `prayer_request:read` at the church. A caller WITHOUT
 * the church-local `prayer_private_request:read` grant sees only STANDARD
 * rows; the private filter is applied before count/pagination inside the
 * controller/provider so hidden rows never leak through `total`. `kind` takes
 * one kind or a comma list. Responses are `private, no-store`.
 */

registerPath({
  path: '/admin/churches/:churchId/requests',
  method: 'get',
  summary: 'List authorized sensitive requests',
  request: {
    params: [
      { name: 'churchId', in: 'path', schema: z.string() },
      { name: 'kind', in: 'query', required: false, schema: RequestKindsParamSchema },
      { name: 'search', in: 'query', required: false, schema: z.string().max(200) },
      {
        name: 'classification',
        in: 'query',
        required: false,
        schema: z.enum(['private', 'standard']),
      },
      { name: 'received_from', in: 'query', required: false, schema: z.string() },
      { name: 'received_to', in: 'query', required: false, schema: z.string() },
    ],
  },
  responses: [
    {
      status: 200,
      description: 'Authorized request summaries',
      schema: z.object({
        success: z.boolean(),
        message: z.string(),
        result: z.array(RequestListSummarySchema),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 404, description: 'Church or requests out of scope (existence hidden)' },
    { status: 422, description: 'Invalid kind, classification or received range' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    const { churchId } = await params
    const searchParams = new URL(req.url).searchParams
    const kinds = validate(RequestKindsQuerySchema, searchParams.get('kind') ?? undefined)
    const filter = validate(RequestListFilterSchema, {
      search: searchParams.get('search') || undefined,
      classification: searchParams.get('classification') ?? undefined,
      received_from: searchParams.get('received_from') ?? undefined,
      received_to: searchParams.get('received_to') ?? undefined,
    })
    const query = parseListQuery(searchParams, { allowOrderBy: ['created_at'] })
    const { session } = await requiredAuth(req)
    const { churchIds } = await resolveRequestReadScope({ userId: session.user.user_id, churchId })
    const result = await listRequests({
      userId: session.user.user_id,
      churchId,
      churchIds,
      kinds,
      filter,
      query,
    })
    return noStore(
      listResponse(result.result, result.total, query.page, query.limit, 'Requests retrieved.'),
    )
  } catch (e) {
    return httpError(e)
  }
}
