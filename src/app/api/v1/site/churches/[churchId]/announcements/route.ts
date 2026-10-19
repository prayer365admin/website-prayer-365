import { NextRequest } from 'next/server'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { listPublicAnnouncements } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    await requiredWebAuth()
    const { churchId } = await params
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listPublicAnnouncements({ churchId, query })
    return list(
      result as unknown[],
      total,
      query.page,
      query.limit,
      'Church announcements retrieved.',
    )
  } catch (e) {
    return httpError(e)
  }
}
