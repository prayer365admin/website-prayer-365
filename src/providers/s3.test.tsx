import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Mock every AWS SDK call so tests never touch a real S3 endpoint.
 */
const createPresignedPostMock = vi.fn()
vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: (...a: unknown[]) => createPresignedPostMock(...a),
}))
const getSignedUrlMock = vi.fn()
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...a: unknown[]) => getSignedUrlMock(...a),
}))
const s3ClientCalls = vi.hoisted(() => ({ options: [] as Record<string, unknown>[] }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(options: Record<string, unknown>) {
      s3ClientCalls.options.push(options)
    }
    send() {
      return Promise.resolve({})
    }
  },
  HeadObjectCommand: class {},
  DeleteObjectCommand: class {},
  GetObjectCommand: class {},
}))

import {
  S3_PRESIGN_UPLOAD,
  S3_HEAD_OBJECT,
  S3_DELETE_OBJECT,
  S3_GET_SIGNED_URL,
  S3_PUBLIC_URL,
} from './s3'

const S3_KEYS = [
  'AWS_S3_BUCKET',
  'S3_BUCKET',
  'AWS_BUCKET_NAME',
  'AWS_REGION',
  'S3_REGION',
  'AWS_ACCESS_KEY_ID',
  'S3_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'S3_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'S3_SESSION_TOKEN',
  'S3_PUBLIC_BASE_URL',
] as const

// Snapshot env once at load; every afterEach restores it so tests are order-independent.
const envSnapshot = (() => {
  const snap: Record<string, string | undefined> = {}
  for (const k of S3_KEYS) snap[k] = process.env[k]
  return snap
})()

const restoreEnv = () => {
  for (const k of S3_KEYS) {
    if (envSnapshot[k] === undefined) delete process.env[k]
    else process.env[k] = envSnapshot[k]
  }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => restoreEnv())

describe('S3 lazy client + config', () => {
  it('module constructs (S3Client) lazily without throwing when creds are absent', async () => {
    // No AWS_* or S3_* creds at all; confirming import works and only a call
    // (which needs a bucket) fails — never module load.
    for (const k of S3_KEYS) delete process.env[k]
    await expect(
      S3_PRESIGN_UPLOAD({ key: 'k', contentType: 'image/png', maxBytes: 100 }),
    ).rejects.toMatchObject({ code: 500, error_code: 'S3_NOT_CONFIGURED' })
  })

  it('throws S3_NOT_CONFIGURED when no bucket is configured', async () => {
    for (const k of S3_KEYS) delete process.env[k]
    await expect(S3_DELETE_OBJECT({ key: 'k' })).rejects.toMatchObject({
      error_code: 'S3_NOT_CONFIGURED',
    })
  })
})

describe('S3_PRESIGN_UPLOAD', () => {
  it('presigns POST with bucket, key, and size + content-type constraints', async () => {
    process.env.AWS_S3_BUCKET = 'bucket-x'
    createPresignedPostMock.mockResolvedValue({ url: 'https://s3/u', fields: { key: 'fk' } })
    const out = await S3_PRESIGN_UPLOAD({
      key: 'media/c1/image/uuid',
      contentType: 'image/png',
      maxBytes: 1024 * 1024,
      expiresIn: 900,
    })
    expect(out.url).toBe('https://s3/u')
    expect(out.key).toBe('media/c1/image/uuid')
    const opts = createPresignedPostMock.mock.calls[0][1]
    expect(opts.Bucket).toBe('bucket-x')
    expect(opts.Key).toBe('media/c1/image/uuid')
    expect(opts.Fields['Content-Type']).toBe('image/png')
    expect(opts.Conditions).toContainEqual(['content-length-range', 1, 1024 * 1024])
    expect(opts.Conditions).toContainEqual(['starts-with', '$Content-Type', 'image/png'])
  })
})

describe('S3_HEAD_OBJECT / S3_GET_SIGNED_URL', () => {
  it('head returns size/content-type', async () => {
    process.env.S3_BUCKET = 'bucket-y'
    const res = await S3_HEAD_OBJECT({ key: 'k' })
    expect(typeof res.contentLength).toBe('number')
  })

  it('get signed url returns a url', async () => {
    process.env.AWS_S3_BUCKET = 'bucket-z'
    getSignedUrlMock.mockResolvedValue('https://signed/url')
    const url = await S3_GET_SIGNED_URL({ key: 'k', expiresIn: 3600 })
    expect(url).toBe('https://signed/url')
  })
})

describe('S3_PUBLIC_URL — stable public read URL (temporary public-read bucket)', () => {
  it('derives the URL from AWS_BUCKET_NAME + AWS_REGION', () => {
    for (const k of S3_KEYS) delete process.env[k]
    process.env.AWS_BUCKET_NAME = 'prayer-bucket'
    process.env.AWS_REGION = 'eu-north-1'
    expect(S3_PUBLIC_URL({ key: 'media/c1/image/abc' })).toBe(
      'https://prayer-bucket.s3.eu-north-1.amazonaws.com/media/c1/image/abc',
    )
  })

  it('prefers S3_PUBLIC_BASE_URL and strips a trailing slash', () => {
    for (const k of S3_KEYS) delete process.env[k]
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.com/'
    expect(S3_PUBLIC_URL({ key: 'media/c1/image/abc' })).toBe(
      'https://cdn.example.com/media/c1/image/abc',
    )
  })

  it('returns null when no bucket is configured', () => {
    for (const k of S3_KEYS) delete process.env[k]
    expect(S3_PUBLIC_URL({ key: 'k' })).toBeNull()
  })
})

describe('S3 client credentials (Lambda temporary credentials)', () => {
  const lastClientOptions = () =>
    s3ClientCalls.options.at(-1) as {
      credentials?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
    }

  it('carries AWS_SESSION_TOKEN so Lambda execution-role keys are valid', async () => {
    for (const k of S3_KEYS) delete process.env[k]
    process.env.AWS_BUCKET_NAME = 'bucket-z'
    process.env.AWS_ACCESS_KEY_ID = 'ASIAEXAMPLE'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'
    process.env.AWS_SESSION_TOKEN = 'session-token'

    await S3_HEAD_OBJECT({ key: 'k' })

    expect(lastClientOptions().credentials).toEqual({
      accessKeyId: 'ASIAEXAMPLE',
      secretAccessKey: 'secret',
      sessionToken: 'session-token',
    })
  })

  it('omits the token for static keys (local / Vercel)', async () => {
    for (const k of S3_KEYS) delete process.env[k]
    process.env.AWS_BUCKET_NAME = 'bucket-z'
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE'
    process.env.AWS_SECRET_ACCESS_KEY = 'secret'

    await S3_HEAD_OBJECT({ key: 'k' })

    expect(lastClientOptions().credentials).toEqual({
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secret',
    })
  })
})
