import { GeneralError } from '@/utils/general-error'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  getSitePrayerArchive: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: mocks.requiredWebAuth }))
vi.mock('@/controller/site-prayer', () => ({
  getSitePrayerArchive: mocks.getSitePrayerArchive,
}))

import { GET } from './route'

describe('GET /api/v1/site/prayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('runs search, filters, and pagination on the server', async () => {
    const archive = { result: [], total: 0, page: 2, limit: 6, totalPages: 2 }
    mocks.getSitePrayerArchive.mockResolvedValue(archive)

    const response = await GET(
      new NextRequest(
        'http://localhost/api/v1/site/prayers?churchId=c1&page=2&search=peace&language=en&duration=short&format=audio',
      ),
    )

    expect(mocks.getSitePrayerArchive).toHaveBeenCalledWith({
      userId: 'u1',
      query: {
        churchId: 'c1',
        page: 2,
        limit: 6,
        search: 'peace',
        language: 'en',
        duration: 'short',
        format: 'audio',
      },
    })
    expect((await response.json()).result).toEqual(archive)
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('returns 401 when website authentication fails', async () => {
    mocks.requiredWebAuth.mockRejectedValue(
      new GeneralError({
        code: 401,
        error: 'Not Authenticated!',
        error_code: 'UNAUTHORIZED',
        details: 'Please login and try again!',
      }),
    )

    const response = await GET(new NextRequest('http://localhost/api/v1/site/prayers'))

    expect(response.status).toBe(401)
  })
})
