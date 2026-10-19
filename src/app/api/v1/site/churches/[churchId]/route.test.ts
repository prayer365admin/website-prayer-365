import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  getPublicChurch: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ getPublicChurch: m.getPublicChurch }))

import { GET } from './route'

describe('GET /api/v1/site/churches/[churchId]', () => {
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

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with public church profile', async () => {
    const fixture = {
      id: 'c1',
      name: 'Grace',
      denomination: 'Lutheran',
      description: 'A historic parish.',
      timezone: 'Europe/Tallinn',
      address: {
        line1: 'Main St 1',
        line2: null,
        city: 'Tallinn',
        postalCode: '10111',
        countryCode: 'EE',
      },
      coordinates: null,
      contacts: {
        email: 'office@grace.ee',
        phone: '+372 123 4567',
      },
      website: 'https://grace.ee',
      socialLinks: [],
      accessibility: 'Wheelchair access',
      coverAssetId: null,
      coverUrl: 'https://cdn.test/cover.jpg',
      languageCodes: ['et', 'en'],
      serviceTimes: [
        {
          weekday: 7,
          localTime: '10:00',
          label: 'Sunday Service',
          languageCode: 'et',
        },
      ],
      distanceKm: null,
    }
    m.getPublicChurch.mockResolvedValue(fixture)

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.getPublicChurch).toHaveBeenCalledWith({
      churchId: 'c1',
      query: { page: 1, limit: 25 },
    })
    expect(body.success).toBe(true)
    expect(body.result).toEqual(fixture)
    expect(body.message).toBe('Church profile retrieved.')
    expect(typeof body.request_id).toBe('string')
  })

  it('returns 404 when the controller throws a not found GeneralError', async () => {
    m.getPublicChurch.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'Not Found',
        error_code: 'NOT_FOUND',
        details: 'Church not found',
      }),
    )

    const res = await GET(new NextRequest('http://localhost/api/v1/site/churches/c1'), {
      params: Promise.resolve({ churchId: 'c1' }),
    })

    expect(res.status).toBe(404)
  })
})
