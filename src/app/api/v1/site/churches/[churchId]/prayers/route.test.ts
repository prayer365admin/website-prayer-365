import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  listPublishedPrayers: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ listPublishedPrayers: m.listPublishedPrayers }))

import { GET } from './route'

describe('GET /api/v1/site/churches/[churchId]/prayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } }, user: {} })
  })

  it('returns 401 when website authentication fails', async () => {
    m.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1/prayers'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with prayers list and pagination envelope', async () => {
    const fixture = [
      {
        id: 'p1',
        churchId: 'c1',
        publishedAt: '2026-10-15T00:00:00.000Z',
        version: {
          prayerVersionId: 'pv1',
          versionNumber: 1,
          pastorId: 'pas1',
          title: 'Peace in Uncertain Times',
          introduction: 'Scripture meditation on Philippians 4:6–7',
          body: 'Do not be anxious about anything...',
          languageCode: 'et',
        },
        audio: null,
      },
    ]
    m.listPublishedPrayers.mockResolvedValue({ result: fixture, total: 1 })

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches/c1/prayers?page=1&limit=10'),
      {
        params: Promise.resolve({ churchId: 'c1' }),
      },
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.listPublishedPrayers).toHaveBeenCalledWith({
      churchId: 'c1',
      query: expect.objectContaining({ page: 1, limit: 10 }),
    })
    expect(body.result).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('returns 404 when the church is not found', async () => {
    m.listPublishedPrayers.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'Not Found',
        error_code: 'CHURCH_NOT_FOUND',
        details: 'Church not found.',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1/prayers'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(404)
  })
})
