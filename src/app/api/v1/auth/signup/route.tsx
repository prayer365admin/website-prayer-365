import { registerUser } from '@/controller/auth'
import { GeneralError } from '@/utils/general-error'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000'
  const baseUrl = req.headers.get('origin') || `http://${host}`
  const { full_name, email, password, confirm_password, locale, main_church_id } = await req.json()

  try {
    if (password !== confirm_password) {
      throw new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'PASSWORD_MISMATCH',
        details: 'Password and confirm password do not match!',
      })
    }

    const result = await registerUser({
      full_name: full_name,
      email: email,
      password: password,
      locale: locale,
      main_church_id: main_church_id,
      baseUrl: baseUrl,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully registered! Please check your email to verify your account.',
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
