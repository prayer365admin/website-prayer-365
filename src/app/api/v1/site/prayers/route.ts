import { getSitePrayerArchive } from '@/controller/site-prayer'
import { SitePrayerArchiveQuerySchema } from '@/models/site-prayer'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, noStore, ok } from '@/utils/response'
import { validate } from '@/utils/validate'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { session } = await requiredWebAuth()
    const query = validate(
      SitePrayerArchiveQuerySchema,
      Object.fromEntries(req.nextUrl.searchParams),
    )
    const archive = await getSitePrayerArchive({ userId: session.user.user_id, query })
    return noStore(ok(archive, 'Prayer archive retrieved.'))
  } catch (error) {
    return httpError(error)
  }
}
