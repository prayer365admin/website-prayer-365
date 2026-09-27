import { NextRequest } from 'next/server'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId as genRequestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MediaUploadBodySchema, MediaUploadOutputSchema, MediaUploadInput } from '@/models/media'
import { createUpload } from '@/controller/media'

/*
 * POST /api/v1/uploads — GLOBAL upload endpoint.
 *
 * There is ONE upload API, not one per entity. Entity context is carried in the
 * request body: `churchId` (the scoping organisation) + `purpose` + the MIME /
 * size constraints. Future entity metadata (entityType, entityId, references)
 * is ADDED to this body schema rather than creating per-entity routes.
 *
 * Flow (SPEC §10.4): request → signed upload URL + PENDING media_assets row →
 * client uploads to S3 → POST /api/v1/uploads/:assetId/complete → READY.
 * The controller resolves purpose-specific scope (prayer_media vs
 * prayer_voice_submission) from churchId + purpose.
 */

registerPath({
  path: '/uploads',
  method: 'post',
  summary: 'Request a global media upload (signed URL + PENDING asset)',
  request: { body: MediaUploadBodySchema },
  responses: [
    {
      status: 200,
      description: 'Signed upload URL + PENDING asset',
      schema: MediaUploadOutputSchema,
    },
    { status: 401, description: 'Not authenticated' },
    { status: 403, description: 'Not allowed for this purpose/church' },
    { status: 404, description: 'Church not found or out of scope' },
    { status: 422, description: 'Validation error (purpose/size/type)' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const { session } = await requiredAuth(req)
    const body = validate(MediaUploadBodySchema, await req.json())
    const input = {
      purpose: body.purpose,
      mimeType: body.mimeType,
      byteSize: body.byteSize,
    } satisfies MediaUploadInput
    const result = await createUpload({
      userId: session.user.user_id,
      churchId: body.churchId,
      input,
      requestId: genRequestId(),
    })
    return ok(result, 'Upload URL created.')
  } catch (e) {
    return httpError(e)
  }
}
