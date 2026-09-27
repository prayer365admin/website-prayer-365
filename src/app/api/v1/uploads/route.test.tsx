import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/media', () => ({ createUpload: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { createUpload } from '@/controller/media'
import { POST } from './route'

const mockAuth = vi.mocked(requiredAuth)
const mockCreate = vi.mocked(createUpload)

const makeReq = (body: unknown) =>
  new NextRequest('http://x/api/v1/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: { user: { user_id: 'u1', role: { id: 'r1', name: 'prayer_church_admin' } } } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    permission: {} as any,
  })
  mockCreate.mockResolvedValue({
    assetId: 'a1',
    objectKey: 'media/c1/image/x',
    uploadUrl: 'https://s3/u',
    fields: { key: 'k', Policy: 'p' },
    expiresIn: 900,
  })
})

describe('POST /api/v1/uploads (global)', () => {
  it('returns 200 with signed URL + PENDING asset for a valid body', async () => {
    const res = await POST(
      makeReq({ churchId: 'c1', purpose: 'IMAGE', mimeType: 'image/png', byteSize: 1024 }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result.uploadUrl).toBe('https://s3/u')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: 'c1', userId: 'u1' }),
    )
    // churchId stripped from the validated input before controller call
    const input = mockCreate.mock.calls[0][0].input as Record<string, unknown>
    expect(input).not.toHaveProperty('churchId')
  })

  it('returns 422 on missing purpose', async () => {
    const res = await POST(makeReq({ churchId: 'c1', mimeType: 'image/png', byteSize: 1024 }))
    expect(res.status).toBe(422)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 422 on missing churchId (entity context required)', async () => {
    const res = await POST(makeReq({ purpose: 'IMAGE', mimeType: 'image/png', byteSize: 1024 }))
    expect(res.status).toBe(422)
  })
})
