import { getHome } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'

export async function GET() {
  try {
    const { session } = await requiredWebAuth()
    const result = await getHome({ userId: session.user.user_id })
    return ok(result, 'Successfully fetched home projection')
  } catch (e) {
    return httpError(e)
  }
}
