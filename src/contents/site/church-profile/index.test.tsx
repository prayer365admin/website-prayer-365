import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, resolveGet, sessionMock } from '@/test/frontend/render'
import ContentsSiteChurchProfile from './index'

const church = {
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
  coverUrl: null,
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

function renderProfile(churchId = 'c1') {
  return renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteChurchProfile churchId={churchId} />
    </SiteI18nProvider>,
  )
}

describe('ContentsSiteChurchProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
  })

  it('renders all public church profile blocks and links', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    renderProfile()

    expect(await screen.findByText('Grace')).toBeTruthy()
    expect(screen.getByText('Lutheran')).toBeTruthy()
    expect(screen.getByText('Tallinn')).toBeTruthy()
    expect(screen.getByText('Sunday 10:00')).toBeTruthy()
    expect(screen.getByText('Sunday Service')).toBeTruthy()
    expect(screen.getByText('Europe/Tallinn')).toBeTruthy()
    expect(screen.getByText('A historic parish.')).toBeTruthy()
    expect(screen.getByText('Main St 1')).toBeTruthy()
    expect(screen.getByText('10111 Tallinn')).toBeTruthy()
    expect(screen.getByText('et, en')).toBeTruthy()
    expect(screen.getByText('Wheelchair access')).toBeTruthy()

    // Section headings
    expect(screen.getByText('Service times')).toBeTruthy()
    expect(screen.getByText('Address')).toBeTruthy()
    expect(screen.getByText('Contacts')).toBeTruthy()
    expect(screen.getByText('Website')).toBeTruthy()
    expect(screen.getByText('Languages')).toBeTruthy()
    expect(screen.getByText('Accessibility')).toBeTruthy()

    // Links
    const emailLink = screen.getByRole('link', { name: 'office@grace.ee' })
    expect(emailLink.getAttribute('href')).toBe('mailto:office@grace.ee')

    const phoneLink = screen.getByRole('link', { name: '+372 123 4567' })
    expect(phoneLink.getAttribute('href')).toBe('tel:+372 123 4567')

    const websiteLink = screen.getByRole('link', { name: 'https://grace.ee' })
    expect(websiteLink.getAttribute('href')).toBe('https://grace.ee')
    expect(websiteLink.getAttribute('target')).toBe('_blank')

    // Cover placeholder initial
    expect(screen.getByText('G')).toBeTruthy()
  })

  it('renders cover image when coverUrl is provided', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet({
        ...church,
        coverUrl: 'https://cdn.test/cover.jpg',
      }),
    })

    renderProfile()

    const img = await screen.findByRole('img', { name: 'Grace' })
    expect(img).toBeTruthy()
  })

  it('renders not found state when church does not exist or is not approved', async () => {
    const error404 = Object.assign(new Error('Request failed with status code 404'), {
      isAxiosError: true,
      response: { status: 404 },
    })
    axiosMock.get.mockRejectedValueOnce(error404)

    renderProfile()

    expect(await screen.findByText('Church not found')).toBeTruthy()
  })

  it('renders generic error state and retries on button click', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockRejectedValueOnce(new Error('boom'))

    renderProfile()

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(church),
    })

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => {
      expect(screen.getByText('Grace')).toBeTruthy()
    })
  })

  it('renders Donate (disabled with not-ready note) and View prayers link', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: resolveGet(church) })

    renderProfile()

    expect(await screen.findByText('Grace')).toBeTruthy()

    const donate = screen.getByRole('button', { name: 'Donate' }) as HTMLButtonElement
    expect(donate.disabled).toBe(true)
    expect(screen.getByText('Donations not ready yet')).toBeTruthy()

    const prayersLink = screen.getByRole('link', { name: 'View prayers' })
    expect(prayersLink.getAttribute('href')).toBe('/churches/c1/prayers')
  })
})
