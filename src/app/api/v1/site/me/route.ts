import { getMe } from '@/controller/mobile'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, ok } from '@/utils/response'

export async function GET() {
  try {
    const { session } = await requiredWebAuth()
    const result = await getMe({ userId: session.user.user_id })

    return ok(result, 'Successfully fetched profile')
  } catch (e) {
    return httpError(e)
  }
}
