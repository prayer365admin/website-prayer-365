import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/media', () => ({ getAccess: vi.fn() }))

import requiredAuth from '@/utils/required-auth'
import { getAccess } from '@/controller/media'
import { GET } from './route'

const mockAuth = vi.mocked(requiredAuth)
const mockGetAccess = vi.mocked(getAccess)

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session: { user: { user_id: 'u1', role: { id: 'r1', name: 'prayer_church_admin' } } } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    permission: {} as any,
  })
  mockGetAccess.mockResolvedValue({
    assetId: 'a1',
    purpose: 'IMAGE',
    mimeType: 'image/png',
    byteSize: 1024,
    status: 'READY',
    url: 'https://preview/u',
    expiresIn: 3600,
  })
})

describe('GET /api/v1/uploads/:assetId/access', () => {
  it('accepts a request without churchId (General asset)', async () => {
    const req = new NextRequest('http://x/api/v1/uploads/a1/access')
    const res = await GET(req, { params: Promise.resolve({ assetId: 'a1' }) })

    expect(res.status).toBe(200)
    expect(mockGetAccess).toHaveBeenCalledWith(expect.objectContaining({ churchId: undefined }))
  })

  it('passes a churchId through unchanged', async () => {
    const req = new NextRequest('http://x/api/v1/uploads/a1/access?churchId=c1')
    const res = await GET(req, { params: Promise.resolve({ assetId: 'a1' }) })

    expect(res.status).toBe(200)
    expect(mockGetAccess).toHaveBeenCalledWith(expect.objectContaining({ churchId: 'c1' }))
  })
})
