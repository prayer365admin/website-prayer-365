import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listPublicChurches, getPublicChurch } = vi.hoisted(() => ({
  listPublicChurches: vi.fn(),
  getPublicChurch: vi.fn(),
}))

vi.mock('@/controller/mobile', () => ({ listPublicChurches, getPublicChurch }))
// `cookies()` needs a request scope; the page only uses the locale for one heading.
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: vi.fn().mockResolvedValue('en') }))
// The interactive directory is a client grid with its own providers; these cases
// only read the server-rendered link list.
vi.mock('@/contents/site/church-directory', () => ({ default: () => null }))
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
    listPublicChurches.mockResolvedValue({ result: [church], total: 1 })
    getPublicChurch.mockResolvedValue(church)
  })

  it('puts the church link in the directory HTML', async () => {
    const Page = (await import('./page')).default
    const { container } = render(await Page())

    const link = container.querySelector('a[href="/churches/st-johns-church"]')
    expect(link?.textContent).toBe("St John's Church — Tallinn")
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
