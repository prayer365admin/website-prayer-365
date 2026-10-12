import { z } from 'zod'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'
import { ChurchOptionSchema } from '@/models/church-option'
import { listFrequentChurches } from '@/controller/church-option'

/*
 * GET /api/v1/public/churches/frequent — the 4 most-followed approved churches
 * for the sign-up "Frequent" chips (WB1). No session, {id, name, city} only.
 * Same answer for every visitor, so the CDN caches it for an hour: the grouped
 * follower count runs about once per hour, not once per visitor.
 */

registerPath({
  path: '/public/churches/frequent',
  method: 'get',
  auth: false,
  summary: 'Top 4 most-followed approved churches (public, minimal fields)',
  responses: [{ status: 200, description: 'Church options', schema: z.array(ChurchOptionSchema) }],
})

export async function GET() {
  try {
    const result = await listFrequentChurches()
    const res = ok(result, 'Frequent churches retrieved.')
    res.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600')
    return res
  } catch (e) {
    return httpError(e)
  }
}
