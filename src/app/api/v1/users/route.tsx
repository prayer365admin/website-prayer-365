import { createUser } from '@/controller/user'
import { GET_USERS } from '@/providers/user'
import { GeneralError } from '@/utils/general-error'
import { parseSearchParams } from '@/utils/parse-search-params'
import requiredAuth from '@/utils/required-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const { limit, order_by, order_direction, page, search } = parseSearchParams(searchParams)

  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('user_management_user').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await GET_USERS({
      limit: limit,
      page: page,
      order_by: order_by,
      order_direction: order_direction,
      search: search,
    })
    return NextResponse.json(
      {
        success: true,
        message: 'Successfully get all users',
        result: result.result,
        total: result.total,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}

export async function POST(req: NextRequest) {
  const { name, password, role_id, email } = await req.json()
  try {
    const { permission } = await requiredAuth(req)

    if (!permission.createAny('user_management_user').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await createUser({
      name: name,
      password: password,
      role_id: role_id,
      email: email,
    })
    return NextResponse.json(
      {
        success: true,
        message: 'Successfully create new user!',
        result: result,
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof GeneralError) {
      return NextResponse.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
