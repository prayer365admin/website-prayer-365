import { NextRequest } from 'next/server'
import { MobileChurchListQuerySchema } from '@/models/mobile'
import { listPublicChurches } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { list, httpError } from '@/utils/response'
import { validate } from '@/utils/validate'

export async function GET(req: NextRequest) {
  try {
    await requiredWebAuth()
    const query = validate(
      MobileChurchListQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const { result, total } = await listPublicChurches({ query })
    return list(result as unknown[], total, query.page, query.limit, 'Churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
