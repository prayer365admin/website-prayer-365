import { z } from 'zod'

/*
 * Mobile avatar upload DTOs (MB-16 / SPEC §8.4 POST M/me/avatar).
 *
 * User-scoped, NOT church-scoped: no church id, no media_assets row. The
 * client posts {mimeType, byteSize}, receives a signed S3 POST, uploads the
 * bytes itself, then PATCHes the resulting public URL as `profilePicture`.
 * Image-only + size-capped so this route can never sign an arbitrary object.
 */

export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const

export const AVATAR_MAX_BYTES = 8 * 1024 * 1024

export const AvatarMimeTypeSchema = z.enum(AVATAR_ALLOWED_MIME)

export const MobileAvatarUploadInputSchema = z
  .object({
    mimeType: AvatarMimeTypeSchema,
    byteSize: z.number().int().positive().max(AVATAR_MAX_BYTES),
  })
  .strict()

export const MobileAvatarUploadOutputSchema = z.object({
  uploadUrl: z.string(),
  fields: z.record(z.string(), z.string()),
  objectKey: z.string(),
  expiresIn: z.number(),
})

export type AvatarMimeType = z.infer<typeof AvatarMimeTypeSchema>
export type MobileAvatarUploadInput = z.infer<typeof MobileAvatarUploadInputSchema>
export type MobileAvatarUploadOutput = z.infer<typeof MobileAvatarUploadOutputSchema>
