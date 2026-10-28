import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/media', () => ({
  CREATE_PENDING_ASSET: vi.fn(),
  GET_ASSET_BY_ID_AND_CHURCH: vi.fn(),
  GET_ASSET_BY_ID_FOR_UPLOADER: vi.fn(),
  GET_ASSET_VISIBLE_TO_CHURCH: vi.fn(),
  MARK_READY: vi.fn(),
  MARK_READY_FOR_UPLOADER: vi.fn(),
}))
vi.mock('@/providers/s3', () => ({
  S3_PRESIGN_UPLOAD: vi.fn(),
  S3_HEAD_OBJECT: vi.fn(),
  S3_GET_SIGNED_URL: vi.fn(),
}))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/utils/db-connection', () => ({ db: { auditLog: { create: vi.fn() } } }))

import { requiredScope } from '@/utils/required-scope'
import {
  GET_ASSET_BY_ID_AND_CHURCH,
  GET_ASSET_BY_ID_FOR_UPLOADER,
  GET_ASSET_VISIBLE_TO_CHURCH,
  CREATE_PENDING_ASSET,
  MARK_READY,
  MARK_READY_FOR_UPLOADER,
} from '@/providers/media'
import { S3_PRESIGN_UPLOAD, S3_HEAD_OBJECT, S3_GET_SIGNED_URL } from '@/providers/s3'
import { createUpload, completeUpload, getAccess } from './media'

const deny = () =>
  Promise.reject(
    Object.assign(new Error('denied'), {
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
    }),
  )

const scopeOk = () => Promise.resolve({ userId: 'u1', churchIds: new Set(['c1']) })

const asset = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'a1',
  church_id: 'c1',
  object_key: 'media/c1/image/x',
  purpose: 'IMAGE',
  mime_type: 'image/png',
  byte_size: BigInt(1024),
  checksum: null,
  status: 'PENDING',
  uploaded_by: 'u1',
  created_at: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

const validUpload = {
  purpose: 'IMAGE' as const,
  mimeType: 'image/png',
  byteSize: 1024,
}

beforeEach(() => vi.clearAllMocks())

describe('createUpload', () => {
  it('creates a signed upload + PENDING asset', async () => {
    vi.mocked(requiredScope).mockResolvedValue(scopeOk() as never)
    vi.mocked(S3_PRESIGN_UPLOAD).mockResolvedValue({
      url: 'https://s3/u',
      fields: { key: 'k' },
      key: 'k',
    } as never)
    vi.mocked(CREATE_PENDING_ASSET).mockResolvedValue({ id: 'a1' } as never)
    const res = await createUpload({
      userId: 'u1',
      churchId: 'c1',
      input: validUpload,
      requestId: 'r',
    })
    expect(res.assetId).toBe('a1')
    expect(S3_PRESIGN_UPLOAD).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/png', maxBytes: 10 * 1024 * 1024 }),
    )
    expect(requiredScope).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'prayer_media', action: 'create' }),
    )
  })

  it('enforces the MIME/type allowlist (purpose mismatch) with 422', async () => {
    await expect(
      createUpload({
        userId: 'u1',
        churchId: 'c1',
        input: { ...validUpload, mimeType: 'audio/mpeg' },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'MEDIA_CONSTRAINT' })
    expect(requiredScope).not.toHaveBeenCalled()
  })

  it('enforces the byte-size cap with 422', async () => {
    await expect(
      createUpload({
        userId: 'u1',
        churchId: 'c1',
        input: { ...validUpload, byteSize: 99 * 1024 * 1024 },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'MEDIA_CONSTRAINT' })
  })

  it('throws 403 for a denied purpose scope', async () => {
    vi.mocked(requiredScope).mockImplementation(deny)
    await expect(
      createUpload({ userId: 'u1', churchId: 'c1', input: validUpload, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })
})

describe('completeUpload', () => {
  it('hides another church asset (404)', async () => {
    vi.mocked(GET_ASSET_BY_ID_AND_CHURCH).mockResolvedValue(null as never)
    await expect(
      completeUpload({
        userId: 'u1',
        churchId: 'c1',
        assetId: 'a9',
        input: { checksum: 'c'.repeat(64) },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('requires an owned upload (403 when not the uploader)', async () => {
    vi.mocked(GET_ASSET_BY_ID_AND_CHURCH).mockResolvedValue(
      asset({ uploaded_by: 'u2', status: 'PENDING' }) as never,
    )
    vi.mocked(requiredScope).mockResolvedValue(scopeOk() as never)
    await expect(
      completeUpload({
        userId: 'u1',
        churchId: 'c1',
        assetId: 'a1',
        input: { checksum: 'c'.repeat(64) },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('rejects object metadata mismatch with 409', async () => {
    vi.mocked(GET_ASSET_BY_ID_AND_CHURCH).mockResolvedValue(asset() as never)
    vi.mocked(requiredScope).mockResolvedValue(scopeOk() as never)
    vi.mocked(S3_HEAD_OBJECT).mockResolvedValue({
      contentLength: 9999,
      contentType: 'image/png',
    } as never)
    await expect(
      completeUpload({
        userId: 'u1',
        churchId: 'c1',
        assetId: 'a1',
        input: { checksum: 'c'.repeat(64) },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'OBJECT_MISMATCH' })
  })

  it('marks the asset READY when metadata matches', async () => {
    vi.mocked(GET_ASSET_BY_ID_AND_CHURCH).mockResolvedValue(asset() as never)
    vi.mocked(requiredScope).mockResolvedValue(scopeOk() as never)
    vi.mocked(S3_HEAD_OBJECT).mockResolvedValue({
      contentLength: 1024,
      contentType: 'image/png',
    } as never)
    vi.mocked(MARK_READY).mockResolvedValue({ count: 1 } as never)
    const res = await completeUpload({
      userId: 'u1',
      churchId: 'c1',
      assetId: 'a1',
      input: { checksum: 'c'.repeat(64) },
      requestId: 'r',
    })
    expect(res).toMatchObject({ id: 'a1', status: 'READY' })
    expect(MARK_READY).toHaveBeenCalledWith(expect.objectContaining({ checksum: 'c'.repeat(64) }))
  })
})

describe('getAccess', () => {
  it('hides a non-READY (unapproved) asset', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(asset({ status: 'PENDING' }) as never)
    await expect(
      getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'ASSET_NOT_READY' })
  })

  it('returns 404 for an out-of-scope / other-church asset', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(null as never)
    await expect(
      getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a9', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('requires prayer_media:read for an IMAGE asset', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(asset({ status: 'READY' }) as never)
    vi.mocked(requiredScope).mockImplementation(deny)
    await expect(
      getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('requires prayer_media:read for a GENERATED_AUDIO asset', async () => {
    vi.mocked(GET_ASSET_BY_ID_AND_CHURCH).mockResolvedValue(
      asset({ purpose: 'GENERATED_AUDIO', status: 'READY' }) as never,
    )
    vi.mocked(requiredScope).mockImplementation(deny)
    await expect(
      getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('returns a signed url for a voice sample owned by the caller (own-submission)', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(
      asset({ purpose: 'VOICE_SAMPLE', status: 'READY', uploaded_by: 'u1' }) as never,
    )
    // voice_profile denied, voice_submission granted (own submission).
    vi.mocked(requiredScope).mockImplementation(((args: unknown) =>
      (args as { subject?: string }).subject === 'prayer_voice_submission'
        ? scopeOk()
        : deny()) as never)
    vi.mocked(S3_GET_SIGNED_URL).mockResolvedValue('https://preview/u')
    const res = await getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' })
    expect(res.url).toBe('https://preview/u')
  })

  it('returns a signed url for a voice sample to a voice reviewer', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(
      asset({ purpose: 'CONSENT_EVIDENCE', status: 'READY', uploaded_by: 'u2' }) as never,
    )
    // voice_profile granted → reviewer path.
    vi.mocked(requiredScope).mockImplementation(((args: unknown) =>
      (args as { subject?: string }).subject === 'prayer_voice_profile'
        ? scopeOk()
        : deny()) as never)
    vi.mocked(S3_GET_SIGNED_URL).mockResolvedValue('https://preview/u')
    const res = await getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' })
    expect(res.url).toBe('https://preview/u')
  })

  it('denies a voice sample to a caller who is neither reviewer nor owner', async () => {
    vi.mocked(GET_ASSET_VISIBLE_TO_CHURCH).mockResolvedValue(
      asset({ purpose: 'VOICE_SAMPLE', status: 'READY', uploaded_by: 'u2' }) as never,
    )
    vi.mocked(requiredScope).mockImplementation(deny)
    await expect(
      getAccess({ userId: 'u1', churchId: 'c1', assetId: 'a1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 403 })
  })
})

describe('USER_AVATAR (user-scoped media)', () => {
  const avatarUpload = { purpose: 'USER_AVATAR' as const, mimeType: 'image/png', byteSize: 1024 }
  const avatarAsset = () =>
    asset({ church_id: null, purpose: 'USER_AVATAR', object_key: 'media/users/u1/avatar/x' })

  it('creates a church-less PENDING asset owned by the caller and skips church scope', async () => {
    vi.mocked(S3_PRESIGN_UPLOAD).mockResolvedValue({
      url: 'https://s3/u',
      fields: {},
      key: 'k',
    } as never)
    vi.mocked(CREATE_PENDING_ASSET).mockResolvedValue({ id: 'a1' } as never)

    const res = await createUpload({ userId: 'u1', input: avatarUpload, requestId: 'r' })

    expect(res.assetId).toBe('a1')
    expect(requiredScope).not.toHaveBeenCalled()
    expect(CREATE_PENDING_ASSET).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: null, uploadedBy: 'u1', purpose: 'USER_AVATAR' }),
    )
    expect(S3_PRESIGN_UPLOAD).toHaveBeenCalledWith(
      expect.objectContaining({ maxBytes: 5 * 1024 * 1024 }),
    )
  })

  it('rejects a USER_AVATAR upload that carries a churchId (422)', async () => {
    await expect(
      createUpload({ userId: 'u1', churchId: 'c1', input: avatarUpload, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_MEDIA_CONTEXT' })
  })

  it('rejects a church-scoped purpose with no churchId (422)', async () => {
    await expect(
      createUpload({ userId: 'u1', input: validUpload, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_MEDIA_CONTEXT' })
  })

  it('completes the caller’s own avatar without a church scope', async () => {
    vi.mocked(GET_ASSET_BY_ID_FOR_UPLOADER).mockResolvedValue(avatarAsset() as never)
    vi.mocked(S3_HEAD_OBJECT).mockResolvedValue({
      contentLength: 1024,
      contentType: 'image/png',
    } as never)
    vi.mocked(MARK_READY_FOR_UPLOADER).mockResolvedValue({ count: 1 } as never)

    const res = await completeUpload({
      userId: 'u1',
      assetId: 'a1',
      input: { checksum: 'c'.repeat(64) },
      requestId: 'r',
    })

    expect(res.status).toBe('READY')
    expect(requiredScope).not.toHaveBeenCalled()
    expect(MARK_READY_FOR_UPLOADER).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: 'a1', uploadedBy: 'u1' }),
    )
  })

  it('hides an avatar asset the caller does not own (404)', async () => {
    vi.mocked(GET_ASSET_BY_ID_FOR_UPLOADER).mockResolvedValue(null as never)
    await expect(
      completeUpload({
        userId: 'u2',
        assetId: 'a1',
        input: { checksum: 'c'.repeat(64) },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })
})
