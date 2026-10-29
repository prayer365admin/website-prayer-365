import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'
import Page from './page'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  // The real redirect() throws to stop rendering; the sentinel carries the target.
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  getPublicChurch: vi.fn(),
  listMyChurches: vi.fn(),
  getMe: vi.fn(),
  getMyDonationOverview: vi.fn(),
  getNeighborSpotlight: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/controller/mobile', () => ({
  getPublicChurch: m.getPublicChurch,
  listMyChurches: m.listMyChurches,
  getMe: m.getMe,
}))
vi.mock('@/controller/donation', () => ({ getMyDonationOverview: m.getMyDonationOverview }))
vi.mock('@/controller/site', () => ({ getNeighborSpotlight: m.getNeighborSpotlight }))
vi.mock('@/providers/stripe', () => ({ isStripeEnabled: () => true }))
vi.mock('@/contents/site/donate', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid="donate">{JSON.stringify(props)}</div>
  ),
}))

const CHURCH = {
  id: 'c1',
  slug: 'st-johns',
  name: "St. John's Church",
  coordinates: null,
  donationOptions: { currency: 'EUR', presetsMinor: [1000], monthlyEnabled: true },
}

const OVERVIEW = {
  year: 2026,
  activeGift: null,
  contributions: [],
  lastPaidAt: null,
  nextGiftAt: null,
}

const signedIn = () =>
  m.requiredWebAuth.mockResolvedValue({
    session: { user: { user_id: 'u1', name: 'Ann', role: null } },
  })

const run = (searchParams: Record<string, string | string[] | undefined> = {}) =>
  Page({ searchParams: Promise.resolve(searchParams) })

/** Props the page handed to the donate screen. */
const props = () =>
  JSON.parse(screen.getByTestId('donate').textContent ?? '{}') as {
    church: { churchId: string; slug: string; churchName: string; isMainParish: boolean } | null
    overview: unknown
    oneTime: boolean
  }

beforeEach(() => {
  vi.clearAllMocks()
  m.getPublicChurch.mockResolvedValue(CHURCH)
  m.listMyChurches.mockResolvedValue([])
  m.getMe.mockResolvedValue({ id: 'u1', mainChurchId: 'c1' })
  m.getMyDonationOverview.mockResolvedValue(OVERVIEW)
  m.getNeighborSpotlight.mockResolvedValue(null)
})

describe('/donate church resolution', () => {
  it('sends a visitor without a session to /login', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(run()).rejects.toThrow('REDIRECT /login')
  })

  it('defaults a bare /donate to the Main Church and bakes it into the URL', async () => {
    signedIn()
    m.listMyChurches.mockResolvedValue([{ churchId: 'c1', slug: 'st-johns', isMain: true }])

    await expect(run()).rejects.toThrow('REDIRECT /donate?church=st-johns')
  })

  it('keeps frequency=one_time through the Main Church redirect', async () => {
    signedIn()
    m.listMyChurches.mockResolvedValue([{ churchId: 'c1', slug: 'st-johns', isMain: true }])

    await expect(run({ frequency: 'one_time' })).rejects.toThrow(
      'REDIRECT /donate?church=st-johns&frequency=one_time',
    )
  })

  it('renders the pick-a-parish state when the giver has no Main Church', async () => {
    signedIn()
    m.listMyChurches.mockResolvedValue([])

    render(await run())

    expect(props().church).toBeNull()
    expect(props().overview).toBeNull()
    expect(m.redirect).not.toHaveBeenCalled()
  })

  it('renders the named church and flags the Main parish from the user record', async () => {
    signedIn()

    render(await run({ church: 'st-johns' }))

    const { church } = props()
    expect(church?.churchId).toBe('c1')
    expect(church?.slug).toBe('st-johns')
    expect(church?.churchName).toBe("St. John's Church")
    expect(church?.isMainParish).toBe(true)
    expect(m.getPublicChurch).toHaveBeenCalledWith({ slug: 'st-johns' })
    // The church list is only needed to resolve a bare /donate, never for the flag.
    expect(m.listMyChurches).not.toHaveBeenCalled()
  })

  it('does not flag another parish as the Main one', async () => {
    signedIn()
    m.getMe.mockResolvedValue({ id: 'u1', mainChurchId: 'c2' })

    render(await run({ church: 'st-johns' }))

    expect(props().church?.isMainParish).toBe(false)
  })

  it('rewrites an id-based link to the canonical slug URL', async () => {
    signedIn()

    await expect(run({ church: '0b6f1f1e-0000-4000-8000-000000000000' })).rejects.toThrow(
      'REDIRECT /donate?church=st-johns',
    )
  })

  it('sends an unknown church to the directory', async () => {
    signedIn()
    m.getPublicChurch.mockRejectedValue(
      new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Church not found or not available.',
      }),
    )

    await expect(run({ church: 'ghost' })).rejects.toThrow('REDIRECT /churches')
  })

  it('lets a real failure propagate instead of reporting "church not found"', async () => {
    signedIn()
    m.getPublicChurch.mockRejectedValue(new Error('BOOM: connection pool exhausted'))

    await expect(run({ church: 'st-johns' })).rejects.toThrow('BOOM')
    expect(m.redirect).not.toHaveBeenCalled()
  })

  it('starts on a one-time gift for a padded frequency param', async () => {
    signedIn()

    render(await run({ church: 'st-johns', frequency: ' one_time ' }))

    expect(props().oneTime).toBe(true)
  })
})
