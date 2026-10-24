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
    // The detail route carries no list filters, but the query model supplies the
    // optional coordinates used to compute `distanceKm` on the profile hero.
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const result = await getPublicChurch({ slug: churchId, churchId, query })
    return ok(result, 'Church profile retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
