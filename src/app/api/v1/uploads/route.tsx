import { httpError } from '@/utils/response'
import { GeneralError } from '@/utils/general-error'
import { NextRequest } from 'next/server'

// Generic uploads are disabled (SPEC §8.3 / Task 11); scoped media uploads
// (Task 33) replace this route. Not a bypass.
export async function POST(_req: NextRequest) {
  return httpError(
    new GeneralError({
      code: 403,
      error: 'FORBIDDEN',
      error_code: 'ROUTE_DISABLED',
      details: 'Generic uploads are disabled; use scoped media uploads.',
    }),
  )
}
