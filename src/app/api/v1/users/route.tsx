import { createUser } from '@/controller/user'
import { GET_USERS } from '@/providers/user'
import { ok, list, httpError, requestId } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { GeneralError } from '@/utils/general-error'
import { validate } from '@/utils/validate'
import { parseSearchParams } from '@/utils/parse-search-params'
import requiredAuth from '@/utils/required-auth'
import { z } from 'zod'
import { NextRequest } from 'next/server'

// Defense-in-depth: never surface password hash regardless of provider shape.
type PasswordShaped = { password?: string | null | undefined }
function protect<T extends PasswordShaped>(row: T): Omit<T, 'password'> {
  const { password: _pw, ...safe } = row
  return safe
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const { limit, order_by, order_direction, page, search } = parseSearchParams(searchParams)
  const role = searchParams.get('role') ?? undefined
  const status = searchParams.get('status') ?? undefined

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

    const result = await GET_USERS({
      limit,
      page,
      order_by,
      order_direction,
      search,
      role,
      status,
    })

    const safeResult = (result.result as Array<Record<string, unknown>>).map((r) => protect(r))
    return list(safeResult, result.total, page ?? 1, limit ?? 25, 'Successfully get all users')
  } catch (error) {
    return httpError(error)
  }
}

const createUserSchema = z.object({
  email: z.string().email().min(1),
  name: z.string().min(1),
  password: z.string().min(8),
  role_id: z.string().min(1).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const { session, permission } = await requiredAuth(req)

    if (!permission.createAny('prayer_administrator').granted) {
      return httpError(
        new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'This account is not allowed for this action.',
        }),
      )
    }

    const body = await req.json().catch(() => ({}))

    const data = validate(createUserSchema, body)

    const result = await createUser({
      email: data.email,
      name: data.name,
      password: data.password,
      role_id: data.role_id,
      actorId: session.user.user_id,
      requestId: requestId(),
    })

    return ok(protect(result), 'Successfully create new user!', 201)
  } catch (error) {
    return httpError(error)
  }
}

registerPath({
  path: '/users',
  method: 'get',
  summary: 'Paginated staff list (central prayer_administrator)',
  responses: [
    {
      status: 200,
      description: 'Staff list (no password)',
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

registerPath({
  path: '/users',
  method: 'post',
  summary:
    'Create staff (password never returned). Role `administrator` also gets its GLOBAL scope assignment automatically.',
  request: {
    body: createUserSchema,
  },
  responses: [
    {
      status: 201,
      description: 'Created user (no password)',
      schema: z.object({
        success: z.literal(true),
        message: z.string(),
        result: z.object({ id: z.string(), email: z.string(), name: z.string() }),
        request_id: z.string(),
      }),
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Forbidden' },
    { status: 422, description: 'Validation error (role_id rejected)' },
  ],
})
