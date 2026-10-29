import { describe, expect, it } from 'vitest'
import { MEDIA_TYPE_ALLOWLIST, MediaCompleteBodySchema, MediaUploadBodySchema } from './media'

/*
 * The initiate body keeps `churchId` OPTIONAL at the schema level (a registered
 * OpenAPI body must stay a plain object), so the pairing rule lives in the
 * controller. These cases pin the schema's half of the contract.
 */
describe('MediaUploadBodySchema', () => {
  it('accepts a USER_AVATAR upload with no churchId', () => {
    expect(
      MediaUploadBodySchema.safeParse({
        purpose: 'USER_AVATAR',
        mimeType: 'image/png',
        byteSize: 1024,
      }).success,
    ).toBe(true)
  })

  it('still accepts a church-scoped body that carries a churchId', () => {
    expect(
      MediaUploadBodySchema.safeParse({
        churchId: 'c1',
        purpose: 'IMAGE',
        mimeType: 'image/png',
        byteSize: 1024,
      }).success,
    ).toBe(true)
  })

  it('caps avatars at 5 MB and rejects audio types', () => {
    expect(MEDIA_TYPE_ALLOWLIST.USER_AVATAR.maxBytes).toBe(5 * 1024 * 1024)
    expect(MEDIA_TYPE_ALLOWLIST.USER_AVATAR.mimeTypes).not.toContain('audio/mpeg')
  })
})

describe('MediaCompleteBodySchema', () => {
  it('accepts a checksum with no churchId (user-scoped asset)', () => {
    expect(MediaCompleteBodySchema.safeParse({ checksum: 'a'.repeat(64) }).success).toBe(true)
  })

  it('rejects a checksum that is not a sha256 hex digest', () => {
    expect(MediaCompleteBodySchema.safeParse({ checksum: 'nope' }).success).toBe(false)
  })
})
