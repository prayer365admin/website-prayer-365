import { GET_CUSTOMERS } from '@/providers/user'
import { list, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { parseSearchParams } from '@/utils/parse-search-params'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const { limit, order_by, order_direction, page, search } = parseSearchParams(searchParams)

  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('prayer_administrator').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const result = await GET_CUSTOMERS({
      limit,
      page,
      order_by,
      order_direction,
      search,
    })

    return list(
      result.result,
      result.total,
      page ?? 1,
      limit ?? 25,
      'Successfully get all customers',
    )
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/customers',
  method: 'get',
  summary: 'Paginated end-user/customer list (role_id null, central prayer_administrator)',
  responses: [
    {
      status: 200,
      description: 'Customer list (no password)',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.array(z.object({ id: z.string(), email: z.string(), name: z.string() })),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
  ],
})
