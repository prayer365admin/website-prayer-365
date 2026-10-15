import { getSetupProgress } from '@/controller/site'
import requiredWebAuth from '@/utils/required-webauth'
import { httpError, noStore, ok } from '@/utils/response'

/*
 * GET /api/v1/site/me/setup-progress — onboarding progress of the session user
 * (WB-15): { churchStepDone, localeStepDone, completed }. Read by the sign-in
 * redirect and the browser setup guard. Subject-only, never cached.
 */
export async function GET() {
  try {
    const { session } = await requiredWebAuth()
    const result = await getSetupProgress({ userId: session.user.user_id })
    return noStore(ok(result, 'Setup progress retrieved.'))
  } catch (e) {
    return httpError(e)
  }
}
