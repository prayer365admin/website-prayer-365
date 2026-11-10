import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPublicChurch } = vi.hoisted(() => ({ getPublicChurch: vi.fn() }))

vi.mock('@/controller/mobile', () => ({ getPublicChurch }))
vi.mock('@/contents/site/church-profile', () => ({
  default: ({ slug }: { slug: string }) => <div data-testid="church-profile">{slug}</div>,
}))

const church = {
  slug: 'st-johns-church',
  name: "St John's Church",
  denomination: 'Lutheran (EELK)',
  description: 'A parish in the old town.',
  timezone: 'Europe/Tallinn',
  address: {
    line1: 'Vene 1',
    line2: null,
    city: 'Tallinn',
    postalCode: '10123',
    countryCode: 'EE',
  },
  coordinates: null,
  contacts: { email: null, phone: null },
  website: null,
  socialLinks: [],
  coverAssetId: null,
  coverUrl: null,
  heroAssetId: null,
  heroUrl: null,
  languageCodes: ['et'],
  serviceTimes: [],
  distanceKm: null,
}

describe('Church Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPublicChurch.mockResolvedValue(church)
  })

  it('server-renders the profile for the slug', async () => {
    const Page = (await import('./page')).default
    const tree = await Page({ params: Promise.resolve({ slug: 'st-johns-church' }) })
    const { getByTestId } = render(tree)

    expect(getByTestId('church-profile').textContent).toBe('st-johns-church')
    expect(getPublicChurch).toHaveBeenCalledWith({ slug: 'st-johns-church' })
  })
})
