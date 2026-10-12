import { listMyChurches } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'

/* GET /api/v1/site/me/churches — the customer's main/followed churches (WB-16). Subject-only. */

export async function GET() {
  try {
    const { session } = await requiredWebAuth()
    const result = await listMyChurches({ userId: session.user.user_id })

    return ok(result, 'Your churches retrieved.')
  } catch (e) {
    return httpError(e)
  }
}
