import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, resolveGet, sessionMock } from '@/test/frontend/render'
import ContentsSiteChurchDirectory from './index'

const summaryA = {
  id: 'c1',
  name: 'Grace',
  denomination: 'Lutheran',
  city: 'Tallinn',
  coverAssetId: null,
  coverUrl: null,
  distanceKm: null,
}

const summaryB = {
  id: 'c2',
  name: 'Hope',
  denomination: 'Baptist',
  city: 'Tartu',
  coverAssetId: 'a1',
  coverUrl: 'https://cdn.test/cover.jpg',
  distanceKm: null,
}

function renderDirectory() {
  return renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteChurchDirectory />
    </SiteI18nProvider>,
  )
}

describe('ContentsSiteChurchDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({
      data: { user: { user_id: 'u1' } },
      status: 'authenticated',
    })
  })

  it('renders cards with name, city, denomination, link, and placeholder initial', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA, summaryB], 2),
    })

    renderDirectory()

    expect(await screen.findAllByText('Grace')).toBeTruthy()
    expect(screen.getByText('Primary Parish')).toBeTruthy()
    expect(screen.getAllByText('Tallinn').length).toBeGreaterThanOrEqual(1)

    const viewDetailsLinks = screen.getAllByRole('link', { name: 'View details' })
    expect(viewDetailsLinks[0].getAttribute('href')).toBe('/churches/c1')
    expect(screen.getAllByText('G').length).toBeGreaterThanOrEqual(1)

    expect(
      screen.getByText('Where two or three gather in my name, there am I with them.'),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View prayers' }).getAttribute('href')).toBe(
      '/churches/c1/prayers',
    )
    expect(screen.getByText('2 welcoming congregations listed')).toBeTruthy()

    expect(screen.getAllByText('Hope').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tartu').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Baptist').length).toBe(2)
  })

  it('renders empty state when no churches are found', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([], 0),
    })

    renderDirectory()

    expect(await screen.findByText('No churches found')).toBeTruthy()
  })

  it('renders error state and retries on button click', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockRejectedValueOnce(new Error('boom'))

    renderDirectory()

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy()

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findAllByText('Grace')).toBeTruthy()
  })

  it('searches churches on Enter in searchbox and resets page to 1', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    renderDirectory()

    await screen.findAllByText('Grace')
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    const searchInput = screen.getByPlaceholderText('Search churches by name or city')
    await user.type(searchInput, 'grace{enter}')

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({ search: 'grace', page: 1 }),
      })
    })
  })

  it('paginates when total exceeds pageSize', async () => {
    const user = userEvent.setup()
    const rows24 = Array.from({ length: 24 }, (_, i) => ({
      ...summaryA,
      id: `c-${i}`,
      name: `Church ${i}`,
    }))

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet(rows24, 25),
    })

    renderDirectory()

    await screen.findAllByText('Church 0')
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryB], 25),
    })

    const page2Item = screen.getByTitle('2')
    await user.click(page2Item)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({ page: 2 }),
      })
    })
  })
  it('renders map pins, selected tooltip, and preview card', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA, summaryB], 2),
    })

    const { container } = renderDirectory()

    expect(await screen.findByText('Grace (Selected)')).toBeTruthy()
    expect(screen.getAllByText('Grace').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/churches/c1')

    const pinButtons = container.querySelectorAll('button[aria-label^="Select"]')
    expect(pinButtons.length).toBe(2)
  })
})
