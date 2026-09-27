import sendMail from '@/controller/mail'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'https://example.com'
  const { to, subject, template_name } = await req.json()

  try {
    await sendMail({
      from: process.env.MAIL_FROM || 'info@example.com',
      to: to,
      subject: subject,
      template_name: template_name,
      payload: {
        first_name: 'Yosa',
        last_name: 'Rama',
      },
      baseUrl: host,
    })

    return NextResponse.json({ data: true, message: 'Successfully send mail' }, { status: 200 })
  } catch (error) {
    if (error instanceof Error) {
      return Response.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
