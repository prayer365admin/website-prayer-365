import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MediaAccessOutputSchema } from '@/models/media'
import { getAccess } from '@/controller/media'

/*
 * GET /api/v1/uploads/:assetId/access — GLOBAL. Entity context (churchId) is a
 * query param here because GET has no body; consistent with the single-upload
 * API contract. Returns a short-lived preview URL for a READY asset. Voice
 * samples / consent evidence additionally require voice-review or the
 * submitting pastor's own-submission grant; other assets require prayer_media.
 * Scope + purpose permission resolved in the controller.
 */

const churchIdParam = { name: 'churchId', in: 'query' as const, required: true, schema: z.string() }

registerPath({
  path: '/uploads/{assetId}/access',
  method: 'get',
  summary: 'Get a short-lived preview URL for a media asset',
  request: {
    params: [{ name: 'assetId', in: 'path', schema: z.string() }, churchIdParam],
  },
  responses: [
    { status: 200, description: 'Short-lived preview URL', schema: MediaAccessOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Asset not ready or not permitted' },
    { status: 404, description: 'Asset not found or out of scope' },
  ],
})

const QuerySchema = z.object({ churchId: z.string().min(1) })

export async function GET(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params
    const { session } = await requiredAuth(req)
    const query = validate(QuerySchema, {
      churchId: req.nextUrl.searchParams.get('churchId'),
    })
    const result = await getAccess({
      userId: session.user.user_id,
      churchId: query.churchId,
      assetId,
      requestId: genRequestId(),
    })
    return ok(result, 'Preview URL generated.')
  } catch (e) {
    return httpError(e)
  }
}
