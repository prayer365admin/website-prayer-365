import { NextRequest, NextResponse } from 'next/server'
import { CredentialsSignin } from 'next-auth'
import { loginUser } from '@/controller/authentication'
import { signAccessToken } from '@/utils/jwt-token'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email and password are required', error_code: 'BAD_REQUEST' },
        { status: 400 },
      )
    }

    const user = await loginUser({ email, password })
    if (!user.role) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password', error_code: 'LOGIN_FAILED' },
        { status: 401 },
      )
    }

    const token = await signAccessToken({
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: { id: user.role.id, name: user.role.name },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully logged in',
        result: { token, expires_in: 60 * 60 * 24 * 7 },
      },
      { status: 200 },
    )
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return NextResponse.json(
        { success: false, message: 'Invalid email or password', error_code: 'LOGIN_FAILED' },
        { status: 401 },
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message, error_code: 'LOGIN_FAILED' },
        { status: 401 },
      )
    }

    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
