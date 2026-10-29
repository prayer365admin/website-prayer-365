import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { DonateNeighborSpotlight, MyDonationOverview } from '@/models/donation'
import { MobileDonationOptions } from '@/models/mobile'
import { axiosMock, replaceMock, renderWithProviders } from '@/test/frontend/render'
import ContentsSiteDonate from './index'

const redirectExternal = vi.hoisted(() => vi.fn())
vi.mock('@/utils/redirect-external', () => ({ redirectExternal }))

const options: MobileDonationOptions = {
  currency: 'EUR',
  presetsMinor: [1000, 2500, 5000, 10000],
  monthlyEnabled: true,
}

const overview: MyDonationOverview = {
  year: 2025,
  activeGift: { amountMinor: 1000, currency: 'EUR', churchId: 'c1', churchName: 'St. John' },
  contributions: [{ currency: 'EUR', totalMinor: 5000, count: 5, months: [0, 1, 2, 3, 4] }],
  lastPaidAt: new Date('2025-05-01T00:00:00Z'),
  nextGiftAt: new Date('2025-06-01T00:00:00Z'),
}

const emptyOverview: MyDonationOverview = {
  year: 2025,
  activeGift: null,
  contributions: [],
  lastPaidAt: null,
  nextGiftAt: null,
}

const renderScreen = ({
  stripeReady = true,
  isMainParish = true,
  data = overview,
  oneTime = false,
  church = {
    churchId: 'c1',
    slug: 'c1',
    churchName: "St. John's Church",
    isMainParish,
    donationOptions: options,
  },
  neighbor = null,
}: {
  stripeReady?: boolean
  isMainParish?: boolean
  data?: MyDonationOverview | null
  oneTime?: boolean
  church?: {
    churchId: string
    slug?: string
    churchName: string
    isMainParish: boolean
    donationOptions?: MobileDonationOptions
  } | null
  neighbor?: DonateNeighborSpotlight | null
} = {}) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteDonate
        church={church}
        oneTime={oneTime}
        overview={data}
        stripeReady={stripeReady}
        userName="Anna"
        neighbor={neighbor}
      />
    </SiteI18nProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContentsSiteDonate (W11)', () => {
  it('renders the stewardship hero and the three trust pillars', () => {
    renderScreen()

    expect(screen.getByRole('heading', { level: 1, name: /support god's work/i })).toBeTruthy()
    expect(
      screen
        .getByRole('heading', { level: 2, name: 'Make an Offering' })
        .closest('section')
        ?.classList.contains('self-start'),
    ).toBe(true)
    expect(screen.getByText('Quiet & Private')).toBeTruthy()
    expect(screen.getByText('Tax-Exempt')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    // Release's sustaining dial (kept on top of this branch's donate rewrite).
    expect(screen.getByText('2025 Sustaining Goal')).toBeTruthy()
    expect(screen.queryByText('Annual Report & Statements')).toBeNull()
    const stewardshipPill = screen.getByText('REVERENT & TRANSPARENT STEWARDSHIP').parentElement
    expect(stewardshipPill?.classList.contains('w-fit')).toBe(true)
    expect(stewardshipPill?.classList.contains('self-start')).toBe(true)
  })

  it('shows the route church as the fixed beneficiary and marks the registered parish', () => {
    renderScreen()

    expect(screen.getAllByText(/St\. John's Church/).length).toBeGreaterThan(0)
    expect(screen.getByText('(Your Registered Parish)', { exact: false })).toBeTruthy()
  })

  it('does not claim the parish is the giver’s registered one when it is not', () => {
    renderScreen({ isMainParish: false })

    expect(screen.queryByText(/\(Your Registered Parish\)/)).toBeNull()
  })

  it('starts on the first preset, monthly, and shows that amount on the CTA', () => {
    renderScreen()

    expect(screen.getByRole('button', { name: /complete gift of €10\.00 \/ month/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Monthly Sustaining Pledge' }).ariaPressed).toBe(
      'true',
    )
  })

  it('starts on a one-time gift when opened from the home One-time Offering link', () => {
    renderScreen({ oneTime: true })

    expect(screen.getByRole('button', { name: 'One-Time Gift' }).ariaPressed).toBe('true')
    expect(screen.getByRole('button', { name: /^complete gift of €10\.00$/i })).toBeTruthy()
  })

  it('drops the monthly suffix for a one-time gift', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'One-Time Gift' }))

    expect(screen.getByRole('button', { name: /^complete gift of €10\.00$/i })).toBeTruthy()
  })

  it('lets a custom amount beat the selected preset', () => {
    renderScreen()

    fireEvent.change(screen.getByLabelText('Or enter a custom amount'), {
      target: { value: '12.34' },
    })

    expect(screen.getByRole('button', { name: /€12\.34/ })).toBeTruthy()
  })

  it('disables checkout with the not-ready note while the backend is off', () => {
    renderScreen({ stripeReady: false })

    const cta = screen.getByRole('button', { name: /complete gift/i }) as HTMLButtonElement
    expect(cta.disabled).toBe(true)
    expect(screen.getByText(/donations are not ready yet/i)).toBeTruthy()
  })

  it('posts one idempotent initiation and redirects to Stripe', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { sessionId: 'cs_1', url: 'https://checkout.stripe.test/cs_1' } },
    })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /complete gift/i }))

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalledTimes(1))
    const [url, body, config] = axiosMock.post.mock.calls[0]
    expect(url).toBe('/api/v1/site/donations')
    expect(body).toMatchObject({
      churchId: 'c1',
      amountMinor: 1000,
      currency: 'eur',
      frequency: 'monthly',
      category: 'general',
      successUrl: expect.stringContaining('/donate/result?session_id={CHECKOUT_SESSION_ID}'),
      cancelUrl: expect.stringContaining('/donate?church=c1'),
    })
    expect(config.headers['Idempotency-Key']).toEqual(expect.any(String))
    await waitFor(() =>
      expect(redirectExternal).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1'),
    )
  })

  it('sends the chosen ministry purpose as the Stripe category', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { sessionId: 'cs_1', url: 'https://checkout.stripe.test/cs_1' } },
    })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /Diaconal Food Pantry/ }))
    fireEvent.click(screen.getByRole('button', { name: /complete gift/i }))

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalledTimes(1))
    expect(axiosMock.post.mock.calls[0][1]).toMatchObject({ category: 'pantry' })
  })

  it('sends an active pledge to the Stripe billing portal', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { url: 'https://billing.stripe.test/p_1' } },
    })
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Pause or Modify Monthly Pledge' }))

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalledTimes(1))
    const [url, body] = axiosMock.post.mock.calls[0]
    expect(url).toBe('/api/v1/site/donations/portal')
    expect(body).toEqual({ returnPath: '/donate?church=c1' })
    await waitFor(() =>
      expect(redirectExternal).toHaveBeenCalledWith('https://billing.stripe.test/p_1'),
    )
  })

  it('reports a portal failure instead of a silent click', async () => {
    axiosMock.post.mockRejectedValue(new Error('provider down'))
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Pause or Modify Monthly Pledge' }))

    await waitFor(() => expect(screen.getByText(/could not open the billing portal/i)).toBeTruthy())
    expect(redirectExternal).not.toHaveBeenCalled()
  })

  it('hides the pause row when the giver has no active pledge', () => {
    renderScreen({ data: emptyOverview })

    expect(screen.queryByRole('button', { name: 'Pause or Modify Monthly Pledge' })).toBeNull()
  })

  it('hides the pause row while the donation integration is off', () => {
    renderScreen({ stripeReady: false })

    expect(screen.queryByRole('button', { name: 'Pause or Modify Monthly Pledge' })).toBeNull()
  })

  it('reports a not-ready refusal instead of pretending the gift started', async () => {
    axiosMock.post.mockRejectedValue(
      Object.assign(new Error('503'), { isAxiosError: true, response: { status: 503 } }),
    )
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /complete gift/i }))

    await waitFor(() => expect(screen.getByText(/donations are not ready/i)).toBeTruthy())
    expect(redirectExternal).not.toHaveBeenCalled()
  })

  it('renders the empty stewardship state instead of inventing a pledge', () => {
    renderScreen({ data: emptyOverview })

    expect(screen.getByText('No active monthly pledge yet.')).toBeTruthy()
    expect(screen.queryByText('Active Patron')).toBeNull()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('switches the beneficiary church via the dropdown and rewrites the URL param', async () => {
    axiosMock.get.mockResolvedValue({
      data: {
        result: [{ id: 'c2', slug: 'tartu-demo', name: 'Tartu Demo Church', city: 'Tartu' }],
      },
    })
    renderScreen()

    const select = screen.getByRole('combobox', { name: /beneficiary/i })
    expect(select).toBeTruthy()

    fireEvent.mouseDown(select)
    const option = await screen.findByText(/Tartu Demo Church/i)
    fireEvent.click(option)

    expect(replaceMock).toHaveBeenCalledWith('/donate?church=tartu-demo')
  })

  it('gates the form on a beneficiary when the giver has no Main Church', () => {
    renderScreen({ church: null, data: null })

    expect(screen.getByRole('heading', { level: 1, name: /support god's work/i })).toBeTruthy()
    expect(screen.getByText('Choose a parish')).toBeTruthy()
    expect(screen.getByText(/Select a beneficiary parish to continue/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /complete gift/i })).toBeNull()
    expect(screen.queryByText('Monthly Sustaining Pledge')).toBeNull()
    expect(screen.queryByText('No active monthly pledge yet.')).toBeNull()
  })

  it('renders the neighbouring parish spotlight with clickable thumbnail and title', () => {
    const neighbor: DonateNeighborSpotlight = {
      churchId: 'c2',
      slug: 'tartu-demo',
      churchName: 'Tartu Demo Church',
      coverUrl: 'https://cdn.test/cover.jpg',
      distanceKm: 12.3,
      prayer: {
        id: 'p1',
        title: 'Morning Vigil for Estonia',
        body: 'Lord God of all creation, guard this land in peace.',
        pastorName: 'Pastor Joel',
        churchName: 'Tartu Demo Church',
      },
    }
    renderScreen({ neighbor })

    expect(screen.getByText('Nearest Church & Prayer')).toBeTruthy()
    const titleLink = screen.getByRole('link', { name: 'Tartu Demo Church' })
    expect(titleLink.getAttribute('href')).toBe('/churches/tartu-demo')
    expect(screen.getByText('Morning Vigil for Estonia')).toBeTruthy()
    expect(screen.getByText(/Lord God of all creation/)).toBeTruthy()
    expect(screen.getByText('Pastor Joel')).toBeTruthy()
  })

  it('does not render the removed payment method, certificate, or transparency elements', () => {
    renderScreen()

    expect(screen.queryByText(/Payment Method/i)).toBeNull()
    expect(screen.queryByText(/256-bit Stripe security/i)).toBeNull()
    expect(screen.queryByText(/Annual Report & Statements/i)).toBeNull()
    expect(screen.queryByText(/Financial Transparency Promise/i)).toBeNull()
    expect(screen.queryByText(/Download Annual Tax Certificate/i)).toBeNull()
  })
})
