import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/s3', () => ({ S3_PRESIGN_UPLOAD: vi.fn() }))

import { S3_PRESIGN_UPLOAD } from '@/providers/s3'
import { AVATAR_MAX_BYTES, MobileAvatarUploadInputSchema } from '@/models/mobile-avatar'
import { createMobileAvatar } from './mobile-avatar'

beforeEach(() => vi.clearAllMocks())

describe('createMobileAvatar — user-scoped signed upload', () => {
  it('signs a key under user-avatars/{userId}/ with the image ext + 8MB cap', async () => {
    vi.mocked(S3_PRESIGN_UPLOAD).mockResolvedValue({
      url: 'https://s3/upload',
      fields: { key: 'k', policy: 'p' },
      key: 'object-key',
    } as never)

    const res = await createMobileAvatar({
      userId: 'u1',
      input: { mimeType: 'image/png', byteSize: 2048 },
    })

    const arg = vi.mocked(S3_PRESIGN_UPLOAD).mock.calls[0][0]
    expect(arg.key.startsWith('user-avatars/u1/')).toBe(true)
    expect(arg.key.endsWith('.png')).toBe(true)
    expect(arg.contentType).toBe('image/png')
    expect(arg.maxBytes).toBe(AVATAR_MAX_BYTES)

    // passthrough of the signed url/fields + key, with the fixed expiry
    expect(res.uploadUrl).toBe('https://s3/upload')
    expect(res.fields).toEqual({ key: 'k', policy: 'p' })
    expect(res.objectKey).toBe('object-key')
    expect(res.expiresIn).toBe(900)
  })

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/webp', 'webp'],
    ['image/heic', 'heic'],
  ])('maps %s to .%s', async (mimeType, ext) => {
    vi.mocked(S3_PRESIGN_UPLOAD).mockResolvedValue({
      url: 'u',
      fields: {},
      key: 'k',
    } as never)
    await createMobileAvatar({ userId: 'u1', input: { mimeType, byteSize: 10 } as never })
    expect(vi.mocked(S3_PRESIGN_UPLOAD).mock.calls[0][0].key.endsWith(`.${ext}`)).toBe(true)
  })

  it('propagates the not-configured error from the S3 provider', async () => {
    vi.mocked(S3_PRESIGN_UPLOAD).mockRejectedValue(
      Object.assign(new Error('no bucket'), { code: 500, error_code: 'S3_NOT_CONFIGURED' }),
    )
    await expect(
      createMobileAvatar({ userId: 'u1', input: { mimeType: 'image/png', byteSize: 10 } }),
    ).rejects.toMatchObject({ code: 500, error_code: 'S3_NOT_CONFIGURED' })
  })
})

describe('MobileAvatarUploadInputSchema — image-only + size cap', () => {
  it('accepts an allowlisted image within the cap', () => {
    expect(
      MobileAvatarUploadInputSchema.safeParse({ mimeType: 'image/jpeg', byteSize: 1024 }).success,
    ).toBe(true)
  })

  it('rejects a non-image MIME', () => {
    expect(
      MobileAvatarUploadInputSchema.safeParse({ mimeType: 'application/pdf', byteSize: 1024 })
        .success,
    ).toBe(false)
  })

  it('rejects oversize and non-positive byte sizes', () => {
    expect(
      MobileAvatarUploadInputSchema.safeParse({
        mimeType: 'image/png',
        byteSize: AVATAR_MAX_BYTES + 1,
      }).success,
    ).toBe(false)
    expect(
      MobileAvatarUploadInputSchema.safeParse({ mimeType: 'image/png', byteSize: 0 }).success,
    ).toBe(false)
  })

  it('rejects unknown keys (strict)', () => {
    expect(
      MobileAvatarUploadInputSchema.safeParse({
        mimeType: 'image/png',
        byteSize: 10,
        userId: 'attacker',
      }).success,
    ).toBe(false)
  })
})
