import { randomUUID } from 'node:crypto'
import { S3_PRESIGN_UPLOAD } from '@/providers/s3'
import { AVATAR_MAX_BYTES, AvatarMimeType } from '@/models/mobile-avatar'
import type { MobileAvatarUploadInput, MobileAvatarUploadOutput } from '@/models/mobile-avatar'

/*
 * Mobile avatar controller (MB-16).
 *
 * Signs an S3 presigned POST for a user-scoped key. No media_assets row and
 * no church scope: the avatar belongs to the user, the mobile uploads the
 * bytes and stores the public URL via PATCH M/me. The presigned POST already
 * binds content-type + byte range server-side.
 */

const EXT_BY_MIME: Record<AvatarMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export const createMobileAvatar = async ({
  userId,
  input,
}: {
  userId: string
  input: MobileAvatarUploadInput
}): Promise<MobileAvatarUploadOutput> => {
  const key = `user-avatars/${userId}/${randomUUID()}.${EXT_BY_MIME[input.mimeType]}`
  const {
    url,
    fields,
    key: objectKey,
  } = await S3_PRESIGN_UPLOAD({
    key,
    contentType: input.mimeType,
    maxBytes: AVATAR_MAX_BYTES,
  })
  return { uploadUrl: url, fields, objectKey, expiresIn: 900 }
}
