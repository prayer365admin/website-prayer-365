import { NextResponse } from 'next/server'
import '@/utils/openapi-registrations'
import { openApiDocument } from '@/utils/openapi'

export async function GET() {
  return NextResponse.json(openApiDocument(), { status: 200 })
}
