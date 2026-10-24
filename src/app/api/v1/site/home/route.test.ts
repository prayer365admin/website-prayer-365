import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  getHome: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('@/controller/mobile', () => ({ getHome: m.getHome }))

import { GET } from './route'

describe('GET /api/v1/site/home', () => {
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

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('returns 200 with home projection envelope', async () => {
    const fixture = {
      mainChurch: {
        id: 'c1',
        name: 'Tallinn St. John',
        denomination: 'Lutheran',
        timezone: 'Europe/Tallinn',
        address: {
          line1: 'Vabaduse valjak 1',
          line2: null,
          city: 'Tallinn',
          postalCode: '10146',
          countryCode: 'EE',
        },
        coordinates: { latitude: 59.4343, longitude: 24.7453 },
        contacts: { email: 'tallinna.jaani@eelk.ee', phone: '+372 644 6206' },
        website: 'https://tallinnajaani.ee',
        socialLinks: [],
        coverAssetId: null,
        coverUrl: null,
        languageCodes: ['et'],
        serviceTimes: [],
        distanceKm: null,
        pastorName: null,
        gallery: [],
        staff: [],
        deaneryName: 'Tallinn Deanery',
      },
      followedChurches: [],
      latestPrayers: [],
      latestEvents: [],
      latestAnnouncements: [],
    }
    m.getHome.mockResolvedValue(fixture)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(m.getHome).toHaveBeenCalledWith({ userId: 'u1' })
    expect(body.success).toBe(true)
    expect(body.result).toEqual(fixture)
    expect(body.message).toBe('Successfully fetched home projection')
    expect(typeof body.request_id).toBe('string')
  })
})
