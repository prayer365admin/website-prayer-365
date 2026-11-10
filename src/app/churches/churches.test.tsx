import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicChurch } = vi.hoisted(() => ({ getPublicChurch: vi.fn() }))

vi.mock('@/controller/mobile', () => ({ getPublicChurch }))
// The profile view is a client component with its own providers; these cases
// only read the metadata helpers.
vi.mock('@/contents/site/church-profile', () => ({ default: () => null }))

const church = {
  id: 'c1',
  slug: 'st-johns-church',
  name: "St John's Church",
  denomination: 'Lutheran (EELK)',
  city: 'Tallinn',
  description: 'A parish in the old town.',
  timezone: 'Europe/Tallinn',
  address: {
    line1: 'Vene 1',
    line2: null,
    city: 'Tallinn',
    postalCode: '10123',
    countryCode: 'EE',
  },
  coordinates: { latitude: 59.44, longitude: 24.75 },
  contacts: { email: 'parish@example.org', phone: '+372 0000 0000' },
  website: 'https://example.org',
  socialLinks: [],
  coverAssetId: null,
  coverUrl: null,
  heroAssetId: null,
  heroUrl: null,
  languageCodes: ['et'],
  serviceTimes: [],
  distanceKm: null,
}

describe('public church pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicChurch.mockResolvedValue(church)
  })

  it('builds metadata from the church row', async () => {
    const { generateMetadata } = await import('./[slug]/page')
    const meta = await generateMetadata({ params: Promise.resolve({ slug: church.slug }) })

    expect(String(meta.title)).toContain(church.name)
    expect(String(meta.title)).toContain('Tallinn')
    expect(meta.alternates?.canonical).toBe('/churches/st-johns-church')
    expect(JSON.stringify(meta)).not.toContain('Catalyst Inertia')
  })

  it('marks a missing church as not indexable', async () => {
    getPublicChurch.mockRejectedValue(new Error('not found'))

    const { generateMetadata } = await import('./[slug]/page')
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })

    expect(meta.robots).toMatchObject({ index: false, follow: false })
  })
})
