import { NextRequest } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MediaCompleteBodySchema, MediaCompleteOutputSchema } from '@/models/media'
import { completeUpload } from '@/controller/media'

/*
 * POST /api/v1/uploads/:assetId/complete — GLOBAL. Entity context (churchId)
 * is in the body, consistent with the single-upload-API contract. Verifies the
 * stored S3 object metadata (size/content-type) against the PENDING row and the
 * supplied sha256 checksum, then marks it READY. Requires an owned upload and
 * the purpose-specific scope (resolved in the controller).
 */

registerPath({
  path: '/uploads/{assetId}/complete',
  method: 'post',
  summary: 'Mark a global media upload as complete (READY)',
  request: {
    params: [{ name: 'assetId', in: 'path', schema: z.string() }],
    body: MediaCompleteBodySchema,
  },
  responses: [
    { status: 200, description: 'Asset marked READY', schema: MediaCompleteOutputSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not the upload owner / not allowed' },
    { status: 404, description: 'Asset not found or out of scope' },
    { status: 409, description: 'Asset not pending / object mismatch' },
    { status: 422, description: 'Validation error (checksum/churchId)' },
  ],
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params
    const { session } = await requiredAuth(req)
    const body = validate(MediaCompleteBodySchema, await req.json())
    const result = await completeUpload({
      userId: session.user.user_id,
      churchId: body.churchId,
      assetId,
      input: { checksum: body.checksum },
      requestId: genRequestId(),
    })
    return ok(result, 'Upload completed.')
  } catch (e) {
    return httpError(e)
  }
}
