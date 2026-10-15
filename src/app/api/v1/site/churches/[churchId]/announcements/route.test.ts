import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  listPublicAnnouncements: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ listPublicAnnouncements: m.listPublicAnnouncements }))

import { GET } from './route'

describe('GET /api/v1/site/churches/[churchId]/announcements', () => {
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

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches/c1/announcements'),
      {
        params: Promise.resolve({ churchId: 'c1' }),
      },
    )

    expect(res.status).toBe(401)
  })

  it('returns 200 with announcements list and pagination envelope', async () => {
    const fixture = [
      {
        id: 'ann1',
        churchId: 'c1',
        title: 'Renovation Update',
        body: 'Nave open for prayer during bell tower maintenance.',
        publishedAt: '2026-10-14T09:00:00.000Z',
      },
    ]
    m.listPublicAnnouncements.mockResolvedValue({ result: fixture, total: 1 })

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches/c1/announcements?page=1&limit=5'),
      {
        params: Promise.resolve({ churchId: 'c1' }),
      },
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.listPublicAnnouncements).toHaveBeenCalledWith({
      churchId: 'c1',
      query: expect.objectContaining({ page: 1, limit: 5 }),
    })
    expect(body.success).toBe(true)
    expect(body.result).toEqual(fixture)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(5)
    expect(body.message).toBe('Church announcements retrieved.')
    expect(typeof body.request_id).toBe('string')
  })

  it('returns 404 when the controller throws a not found GeneralError (suspended church)', async () => {
    m.listPublicAnnouncements.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'Not Found',
        error_code: 'NOT_FOUND',
        details: 'Church not found or not available.',
      }),
    )

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches/c1/announcements'),
      {
        params: Promise.resolve({ churchId: 'c1' }),
      },
    )

    expect(res.status).toBe(404)
  })
})
