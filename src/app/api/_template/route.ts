import { GET_DATA } from '@/providers/_example-with-pagination'
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

    const result = await GET_DATA({
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
  const {} = await req.json()
  try {
    await requiredAuth(req)
    // Actions Here
    const result = 'PUT YOUR RESULT HERE!'
    return NextResponse.json(
      {
        success: true,
        message: 'Successfully create new data!',
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
