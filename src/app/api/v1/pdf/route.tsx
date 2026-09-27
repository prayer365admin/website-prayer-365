import { NextRequest, NextResponse } from 'next/server'

import generatePdf from '@/controller/generate-pdf'
import { generatePdfRequest } from '@/models/generate-pdf'
import { GeneralError } from '@/utils/general-error'

export async function POST(req: NextRequest) {
  const baseUrl = req.nextUrl.origin
  const requestBody: generatePdfRequest = await req.json()
  const { mode, template_name, payload } = requestBody

  try {
    const pdfBuffer = await generatePdf({
      template_name: template_name,
      payload: payload,
      mode: mode,
      baseUrl: baseUrl,
    })
    const headers = new Headers()

    headers.set('Content-Type', 'application/pdf')

    if (mode === 'DOWNLOAD') {
      headers.set('Content-Disposition', 'inline; filename="sample.pdf')
    } else {
      headers.set('Content-Disposition', 'attachment; filename="sample.pdf')
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      statusText: 'OK',
      headers,
    })
  } catch (error) {
    if (error instanceof GeneralError) {
      return Response.json(error, { status: error.code })
    }

    if (error instanceof Error) {
      return Response.json({ error: error.message, details: error }, { status: 500 })
    }
  }
}
