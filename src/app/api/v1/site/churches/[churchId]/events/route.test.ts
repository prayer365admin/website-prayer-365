import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  listPublicEvents: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ listPublicEvents: m.listPublicEvents }))

import { GET } from './route'

describe('GET /api/v1/site/churches/[churchId]/events', () => {
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

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1/events'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with events list and pagination envelope', async () => {
    const fixture = [
      {
        id: 'ev1',
        churchId: 'c1',
        category: 'WORSHIP',
        title: 'Sunday Service',
        description: 'Morning communion',
        startsAt: '2026-10-18T10:00:00.000Z',
        location: 'Main Sanctuary',
        registrationUrl: 'https://example.com/join',
        languageCode: 'et',
      },
    ]
    m.listPublicEvents.mockResolvedValue({ result: fixture, total: 1 })

    const res = await GET(
      new NextRequest('http://localhost/api/v1/site/churches/c1/events?page=1&limit=10'),
      {
        params: Promise.resolve({ churchId: 'c1' }),
      },
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.listPublicEvents).toHaveBeenCalledWith({
      churchId: 'c1',
      query: expect.objectContaining({ page: 1, limit: 10 }),
    })
    expect(body.success).toBe(true)
    expect(body.result).toEqual(fixture)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(10)
    expect(body.message).toBe('Church events retrieved.')
    expect(typeof body.request_id).toBe('string')
  })

  it('returns 404 when the controller throws a not found GeneralError (suspended church)', async () => {
    m.listPublicEvents.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'Not Found',
        error_code: 'NOT_FOUND',
        details: 'Church not found or not available.',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1/events'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(404)
  })
})
