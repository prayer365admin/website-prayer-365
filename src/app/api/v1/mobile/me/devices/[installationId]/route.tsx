import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import requiredAuth from '@/utils/required-auth'
import { ok, httpError, requestId } from '@/utils/response'
import { validate } from '@/utils/validate'
import { registerPath } from '@/utils/openapi'
import { MobileDeviceRegistrationSchema } from '@/models/mobile'
import { registerDevice, revokeDevice } from '@/controller/mobile'

/*
 * PUT / DELETE /api/v1/mobile/me/devices/:installationId (MB-05).
 * Binds the native FCM token to the authenticated installation; the URL owns
 * identity (no userId in the body) and a DELETE is idempotent soft revoke.
 */

const DeviceAckSchema = z.object({
  installationId: z.string(),
  platform: z.string(),
  provider: z.string(),
  updatedAt: z.string(),
})

registerPath({
  path: '/mobile/me/devices/:installationId',
  method: 'put',
  summary: 'Bind the native FCM token to this authenticated installation',
  request: {
    params: [{ name: 'installationId', in: 'path', schema: z.string().min(1) }],
    body: MobileDeviceRegistrationSchema,
  },
  responses: [
    { status: 200, description: 'Registered binding', schema: DeviceAckSchema },
    { status: 401, description: 'Not authenticated' },
    { status: 422, description: 'Validation error' },
  ],
})

registerPath({
  path: '/mobile/me/devices/:installationId',
  method: 'delete',
  summary: 'Revoke this installation device binding',
  request: { params: [{ name: 'installationId', in: 'path', schema: z.string().min(1) }] },
  responses: [
    { status: 204, description: 'Unbound' },
    { status: 401, description: 'Not authenticated' },
  ],
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ installationId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { installationId } = await params
    const body = validate(MobileDeviceRegistrationSchema, await req.json().catch(() => ({})))
    const result = await registerDevice({
      userId: session.user.user_id,
      installationId,
      input: body,
      requestId: requestId(),
    })
    return ok(result, 'Device registered.')
  } catch (e) {
    return httpError(e)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ installationId: string }> },
) {
  try {
    const { session } = await requiredAuth(req)
    const { installationId } = await params
    await revokeDevice({
      userId: session.user.user_id,
      installationId,
      requestId: requestId(),
    })
    return new NextResponse(null, { status: 204 })
  } catch (e) {
    return httpError(e)
  }
}
