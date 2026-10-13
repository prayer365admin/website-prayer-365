import { NextRequest } from 'next/server'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { getPublicChurch } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { ok, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'

export async function GET(req: NextRequest, { params }: { params: Promise<{ churchId: string }> }) {
  try {
    await requiredWebAuth()
    const { churchId } = await params
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await getPublicChurch({ churchId, query })
    return ok(result, 'Church profile retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
