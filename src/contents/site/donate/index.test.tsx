import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { MyDonationOverview } from '@/models/donation'
import { MobileDonationOptions } from '@/models/mobile'
import { axiosMock, pushMock, renderWithProviders } from '@/test/frontend/render'
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
}: {
  stripeReady?: boolean
  isMainParish?: boolean
  data?: MyDonationOverview
  oneTime?: boolean
} = {}) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteDonate
        churchId="c1"
        churchName="St. John's Church"
        donationOptions={options}
        isMainParish={isMainParish}
        oneTime={oneTime}
        overview={data}
        stripeReady={stripeReady}
        userName="Anna"
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
    expect(screen.getByText('Quiet & Private')).toBeTruthy()
    expect(screen.getByText('Tax-Exempt')).toBeTruthy()
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.queryByText('Annual Report & Statements')).toBeNull()
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
    expect(url).toBe('/api/v1/site/churches/c1/donations')
    expect(body).toMatchObject({
      amountMinor: 1000,
      currency: 'eur',
      frequency: 'monthly',
      successUrl: expect.stringContaining('/donate/result?session_id={CHECKOUT_SESSION_ID}'),
      cancelUrl: expect.stringContaining('/donate/c1'),
    })
    expect(config.headers['Idempotency-Key']).toEqual(expect.any(String))
    await waitFor(() =>
      expect(redirectExternal).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1'),
    )
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

  it('switches the beneficiary church via the dropdown and navigates', async () => {
    axiosMock.get.mockResolvedValue({
      data: { result: [{ id: 'c2', name: 'Tartu Demo Church', city: 'Tartu' }] },
    })
    renderScreen()

    const select = screen.getByRole('combobox', { name: /beneficiary/i })
    expect(select).toBeTruthy()

    fireEvent.mouseDown(select)
    const option = await screen.findByText(/Tartu Demo Church/i)
    fireEvent.click(option)

    expect(pushMock).toHaveBeenCalledWith('/donate/c2')
  })
})
