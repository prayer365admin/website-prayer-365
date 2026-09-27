import { GET_PERMISSIONS } from '@/providers/permission'
import { GeneralError } from '@/utils/general-error'
import requiredAuth from '@/utils/required-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const {} = req.nextUrl.searchParams
  try {
    const { permission } = await requiredAuth(req)

    if (!permission.readAny('user_management_permission').granted) {
      throw new GeneralError({
        code: 403,
        details: 'This account not allowed for this actions',
        error_code: 'NOT_ALLOWED',
        error: 'UNAUTHORIZED',
      })
    }

    const result = await GET_PERMISSIONS()
    return NextResponse.json(
      { success: true, message: 'Successfully get all permission!', result: result },
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
