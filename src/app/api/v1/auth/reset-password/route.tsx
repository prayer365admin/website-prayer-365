import { resetPassword } from '@/controller/auth'
import { GeneralError } from '@/utils/general-error'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token, new_password, confirm_password } = await req.json()

  try {
    if (new_password !== confirm_password) {
      throw new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'PASSWORD_MISMATCH',
        details: 'Password and confirm password do not match!',
      })
    }

    const result = await resetPassword({ token: token, new_password: new_password })

    return NextResponse.json(
      {
        success: true,
        message: 'Password has been reset successfully! You can now login.',
        result,
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
