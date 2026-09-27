import { requestPasswordReset } from '@/controller/auth'
import { GeneralError } from '@/utils/general-error'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000'
  const baseUrl = req.headers.get('origin') || `http://${host}`
  const { email }: { email: string } = await req.json()

  try {
    const result = await requestPasswordReset({ email: email, baseUrl: baseUrl })

    return NextResponse.json(
      {
        success: true,
        message: 'If your email is registered, a password reset link has been sent!',
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
