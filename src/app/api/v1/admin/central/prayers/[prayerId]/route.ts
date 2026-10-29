import { getCentralPrayer } from '@/controller/prayer'
import requiredAuth from '@/utils/required-auth'
import { registerPath } from '@/utils/openapi'
import { httpError, ok } from '@/utils/response'
import { requiredScope } from '@/utils/required-scope'
import { NextRequest } from 'next/server'
import { z } from 'zod'

registerPath({
  path: '/admin/central/prayers/:prayerId',
  method: 'get',
  summary: 'Get a prayer in the caller central church scope',
  request: {
    params: [{ name: 'prayerId', in: 'path', schema: z.string() }],
  },
  responses: [
    { status: 200, description: 'Prayer detail' },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed' },
    { status: 404, description: 'Prayer not found or out of scope' },
  ],
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ prayerId: string }> }) {
  try {
    const { prayerId } = await params
    const { session } = await requiredAuth(req)
    const { churchIds } = await requiredScope({
      userId: session.user.user_id,
      central: true,
      subject: 'prayer_prayer',
      action: 'read',
    })
    const result = await getCentralPrayer({ churchIds, prayerId })
    return ok(result, 'Prayer retrieved.')
  } catch (error) {
    return httpError(error)
  }
}
