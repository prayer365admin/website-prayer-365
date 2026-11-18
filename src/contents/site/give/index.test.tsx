import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import ContentsSiteGive from './index'

const redirectExternal = vi.hoisted(() => vi.fn())
vi.mock('@/utils/redirect-external', () => ({ redirectExternal }))

const presetsMinor = [500, 1000, 2500, 5000]

const renderScreen = ({ stripeReady = true, canceled = false } = {}) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteGive
        canceled={canceled}
        currency="EUR"
        presetsMinor={presetsMinor}
        stripeReady={stripeReady}
      />
    </SiteI18nProvider>,
  )

const submitButton = () => screen.getByRole('button', { name: /give/i })

beforeEach(() => {
  vi.clearAllMocks()
  axiosMock.post.mockResolvedValue({
    data: { result: { sessionId: 'cs_1', url: 'https://checkout.stripe.test/cs_1' } },
  })
})

describe('ContentsSiteGive — public giving', () => {
  it('renders the beneficiary notice, four presets and the custom amount field', () => {
    renderScreen()

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveBeneficiaryNotice)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.publicGiveAmountLabel)).toBeTruthy()
    presetsMinor.forEach((minor) => {
      expect(screen.getByText(`€${(minor / 100).toFixed(2)}`)).toBeTruthy()
    })
    expect(screen.getByLabelText(SITE_MESSAGES.en.publicGiveCustomAmount)).toBeTruthy()
  })

  it('posts exactly the public contract — no church, no frequency choice, no return URL', async () => {
    renderScreen()

    fireEvent.click(submitButton())

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalled())
    const [url, body] = axiosMock.post.mock.calls[0]
    expect(url).toBe('/api/v1/site/donations/public')
    expect(body).toEqual({ amountMinor: 500, currency: 'eur', frequency: 'one_time' })
    expect(redirectExternal).toHaveBeenCalledWith('https://checkout.stripe.test/cs_1')
  })

  it('takes a custom amount over the selected preset', async () => {
    renderScreen()

    const input = screen.getByLabelText(SITE_MESSAGES.en.publicGiveCustomAmount)
    fireEvent.change(input, { target: { value: '12,50' } })
    fireEvent.click(submitButton())

    await waitFor(() => expect(axiosMock.post).toHaveBeenCalled())
    expect(axiosMock.post.mock.calls[0][1]).toEqual({
      amountMinor: 1250,
      currency: 'eur',
      frequency: 'one_time',
    })
  })

  it('disables submit for an amount outside 1–5,000 EUR', () => {
    renderScreen()

    const input = screen.getByLabelText(SITE_MESSAGES.en.publicGiveCustomAmount)
    fireEvent.change(input, { target: { value: '0,50' } })
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: '5000,01' } })
    expect((submitButton() as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(input, { target: { value: '25' } })
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false)
  })

  it('disables submit when the payment provider is off and says why', () => {
    renderScreen({ stripeReady: false })

    expect((submitButton() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(SITE_MESSAGES.en.publicGiveNotReady)).toBeTruthy()
  })

  it('shows the not-ready copy when the endpoint answers 503', async () => {
    axiosMock.post.mockRejectedValue(
      Object.assign(new Error('Service Unavailable'), {
        isAxiosError: true,
        response: { status: 503 },
      }),
    )
    renderScreen()

    fireEvent.click(submitButton())

    expect(await screen.findByText(SITE_MESSAGES.en.publicGiveNotReady)).toBeTruthy()
    expect(redirectExternal).not.toHaveBeenCalled()
  })

  it('shows the generic failure copy for any other error and never redirects', async () => {
    axiosMock.post.mockRejectedValue(
      Object.assign(new Error('Bad Gateway'), {
        isAxiosError: true,
        response: { status: 500 },
      }),
    )
    renderScreen()

    fireEvent.click(submitButton())

    expect(await screen.findByText(SITE_MESSAGES.en.publicGiveInitiateFailed)).toBeTruthy()
    expect(redirectExternal).not.toHaveBeenCalled()
  })

  it('acknowledges a cancelled checkout', () => {
    renderScreen({ canceled: true })

    expect(screen.getByText(SITE_MESSAGES.en.publicGiveCanceledNotice)).toBeTruthy()
  })
})
