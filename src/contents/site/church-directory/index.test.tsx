import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, resolveGet, sessionMock } from '@/test/frontend/render'
import ContentsSiteChurchDirectory from './index'

vi.mock('@/components/common/google-map', () => ({
  GoogleMapPins: ({
    points,
    activeId,
    onSelect,
  }: {
    points: { id: string }[]
    activeId?: string
    onSelect?: (id: string) => void
  }) => (
    <div data-testid="gm-pins" data-active={activeId}>
      {points.map(({ id }) => (
        <button key={id} type="button" aria-label={`Pin ${id}`} onClick={() => onSelect?.(id)} />
      ))}
    </div>
  ),
}))
const summaryA = {
  id: 'c1',
  slug: 'grace',
  name: 'Grace',
  denomination: 'Lutheran',
  city: 'Tallinn',
  coverAssetId: null,
  coverUrl: null,
  distanceKm: null,
  latitude: 59.437,
  longitude: 24.754,
}

const summaryB = {
  id: 'c2',
  slug: 'hope',
  name: 'Hope',
  denomination: 'Baptist',
  city: 'Tartu',
  coverAssetId: 'a1',
  coverUrl: 'https://cdn.test/cover.jpg',
  distanceKm: null,
  latitude: 58.378,
  longitude: 26.729,
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
    // The page also loads the home projection to know the user's main church.
    axiosMock.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes('/site/home')
          ? {
              result: {
                mainChurch: { id: 'c1' },
                followedChurches: [],
                latestPrayers: [],
                latestEvents: [],
                latestAnnouncements: [],
              },
            }
          : resolveGet([], 0),
      }),
    )
  })

  it('renders cards with name, city, denomination, link, and placeholder initial', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA, summaryB], 2),
    })

    renderDirectory()
    expect(await screen.findByText('Primary Parish')).toBeTruthy()
    expect(screen.getAllByText('Lutheran').length).toBeGreaterThanOrEqual(0)
    expect(screen.getAllByText('Grace').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tallinn').length).toBeGreaterThanOrEqual(1)

    const viewDetailsLinks = screen.getAllByRole('link', { name: 'View details' })
    expect(viewDetailsLinks[0].getAttribute('href')).toBe('/churches/grace')
    expect(screen.getAllByText('G').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2 welcoming congregations listed')).toBeTruthy()

    expect(screen.getAllByText('Hope').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tartu').length).toBeGreaterThanOrEqual(1)
    // Thumbnail denomination badge only (the style pill no longer repeats it).
    expect(screen.getAllByText('Baptist').length).toBeGreaterThanOrEqual(1)
  })

  it('marks only the user main church as Primary Parish', async () => {
    axiosMock.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes('/site/home')
          ? { result: { mainChurch: { id: 'c2' }, followedChurches: [], latestPrayers: [] } }
          : resolveGet([summaryA, summaryB], 2),
      }),
    )

    renderDirectory()
    expect(await screen.findByText('Primary Parish')).toBeTruthy()
    // Exactly one featured card, and it belongs to c2.
    const cards = screen.getAllByText('Primary Parish')
    expect(cards).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Directions' })).toHaveLength(1)
    // Primary church (c2 = Hope) is sorted to the very top
    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings[0].textContent).toBe('Hope')
    expect(screen.queryByText('Details & Bulletin')).toBeNull()
    const viewDetailsLinks = screen.getAllByRole('link', { name: 'View details' })
    expect(viewDetailsLinks).toHaveLength(2)
    // Primary church (Hope) has "View details" button linking to its profile
    expect(viewDetailsLinks[0].getAttribute('href')).toBe('/churches/hope')
    // Non-featured church (Grace) has "View details" text link linking to its profile
    expect(viewDetailsLinks[1].getAttribute('href')).toBe('/churches/grace')
    // Bottom donation banner for church listing
    expect(
      screen.getByText(
        /Support the sacred heritage, community meals, and ongoing pastoral ministry of local churches./i,
      ),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Support Local Churches' }).getAttribute('href')).toBe(
      '/donate',
    )
  })

  it('shows the church style pill and keeps the denomination badge separate', async () => {
    // No main church in the list -> no featured card; the style pill belongs to
    // whichever card has a churchStyle.
    const summaryFallback = {
      ...summaryA,
      id: 'c-fallback',
      denomination: 'Lutheran (EELK)',
    }
    const summaryStyle = {
      ...summaryB,
      id: 'c-style',
      denomination: 'Baptist (EEKBKL)',
      churchStyle: 'Youth & Student Parish',
    }
    axiosMock.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: url.includes('/site/home')
          ? { result: { mainChurch: null, followedChurches: [], latestPrayers: [] } }
          : resolveGet([summaryFallback, summaryStyle], 2),
      }),
    )

    renderDirectory()
    expect(await screen.findByText('Youth & Student Parish')).toBeTruthy()
    // The pill no longer duplicates the acronym; the acronym comes from the
    // thumbnail badge (and the map preview card).
    expect(screen.getAllByText('EELK').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Primary Parish')).toBeNull()
  })

  it('formats denomination to show only text inside parentheses when present (e.g. Lutheran (EELK) => EELK)', async () => {
    const summaryEELK = {
      ...summaryA,
      id: 'c-eelk',
      denomination: 'Lutheran (EELK)',
    }
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryEELK], 1),
    })

    renderDirectory()
    expect((await screen.findAllByText('Grace')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('EELK').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Lutheran (EELK)')).toBeNull()
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

  it('auto-searches with 500ms debounce when user types without pressing Enter and shows loading skeleton', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    const { container } = renderDirectory()
    await screen.findAllByText('Grace')

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryB], 1),
    })

    const searchInput = screen.getByPlaceholderText('Search churches by name or city')
    await user.type(searchInput, 'hope')

    // While debouncing, loading skeletons and search input loading icon should be displayed
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(container.querySelector('.anticon-loading')).toBeTruthy()
    // After 500ms debounce, API request triggers
    await waitFor(
      () => {
        expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
          params: expect.objectContaining({ search: 'hope', page: 1 }),
        })
      },
      { timeout: 2000 },
    )

    // Once data arrives, result is shown
    const hopeElements = await screen.findAllByText('Hope')
    expect(hopeElements.length).toBeGreaterThan(0)
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
  it('renders map pins and preview card, updating preview card on pin select', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA, summaryB], 2),
    })

    renderDirectory()

    expect(await screen.findByRole('button', { name: 'Pin c1' })).toBeTruthy()
    const pinsContainer = screen.getByTestId('gm-pins')
    expect(pinsContainer.getAttribute('data-active')).toBe('c1')

    expect(screen.getAllByText('Grace').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe(
      '/churches/grace',
    )
    expect(screen.getByText(/Tallinn • Sanctuary Map/i)).toBeTruthy()

    const pin2 = screen.getByRole('button', { name: 'Pin c2' })
    await user.click(pin2)

    await waitFor(() => {
      expect(pinsContainer.getAttribute('data-active')).toBe('c2')
      expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe(
        '/churches/hope',
      )
      expect(screen.getByText(/Tartu • Sanctuary Map/i)).toBeTruthy()
    })
  })

  it('selects denomination filter from dropdown and triggers API fetch', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    renderDirectory()
    await screen.findAllByText('Grace')

    // Open denomination dropdown
    const denomCombo = screen.getByRole('combobox', { name: 'All Denominations' })
    await user.click(denomCombo)

    // Click "Lutheran" option
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })
    const lutheranOption = await screen.findByTitle('Lutheran')
    await user.click(lutheranOption)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({ denomination: 'Lutheran', page: 1 }),
      })
    })

    // Free-typed value (tags combo, not a closed enum) keeps working. Clear
    // with the token's × button, then type into the combo's inner textbox and
    // click the dropdown item antd generates for the typed text.
    await user.click(screen.getByLabelText('close'))
    const denomInput = screen.getAllByRole('combobox', {
      name: 'All Denominations',
    })[0] as HTMLElement
    await user.type(denomInput, 'Orthodox (EAÕK)')
    const typedOption = await screen.findByTitle('Orthodox (EAÕK)')
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })
    await user.click(typedOption)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenLastCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({ denomination: 'Orthodox (EAÕK)', page: 1 }),
      })
    })
  })

  it('selects radius filter from dropdown and triggers API fetch with coordinates', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    renderDirectory()
    await screen.findAllByText('Grace')

    // Open distance dropdown
    const radiusCombo = screen.getByRole('combobox', { name: 'All Distance' })
    await user.click(radiusCombo)
    expect((await screen.findAllByTitle('All Distance')).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Within 10 km')).toHaveLength(1)

    // Click "Within 25 km" option
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })
    const radius25Option = await screen.findByTitle('Within 25 km')
    await user.click(radius25Option)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({
          radius_km: 25,
          latitude: 59.437,
          longitude: 24.754,
          page: 1,
        }),
      })
    })
  })

  it('renders service times in church card with Body Xs SemiBold styling (12px, 600 weight, #2F7AD2)', async () => {
    const summaryWithService = {
      ...summaryA,
      id: 'c-service',
      serviceTimes: 'Sunday Divine Service 10:00 • Evening Prayer 17:00',
    }
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryWithService], 1),
    })

    renderDirectory()
    const formattedElements = await screen.findAllByText('Sun 10:00 AM • Sun 5:00 PM')
    expect(formattedElements.length).toBeGreaterThanOrEqual(1)
    for (const formatted of formattedElements) {
      expect(formatted.tagName).toBe('SPAN')
      const container = formatted.parentElement
      expect(container?.className).toContain('text-xs')
      expect(container?.className).toContain('font-semibold')
      expect(container?.className).toContain('text-[#2F7AD2]')
      expect(container?.className).toContain('leading-[150%]')
      expect(container?.className).toContain('font-font_text')
    }
  })

  it('requests geolocation permission on mount and calculates distance using user coordinates', async () => {
    const getCurrentPositionMock = vi.fn().mockImplementation((success) => {
      success({
        coords: {
          latitude: 59.5,
          longitude: 24.8,
        },
      })
    })
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: getCurrentPositionMock,
      },
    })

    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    renderDirectory()
    expect(getCurrentPositionMock).toHaveBeenCalled()

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({
          latitude: 59.5,
          longitude: 24.8,
        }),
      })
    })

    vi.unstubAllGlobals()
  })

  it('renders custom icons for pastor (user-tie), calendar, view details arrow, and primary buttons', async () => {
    const summaryFull = {
      ...summaryA,
      pastorName: 'Pastor Patrik Göransson',
      serviceTimes: 'Friday Youth 19:30',
    }
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryFull], 1),
    })

    const { container } = renderDirectory()
    expect((await screen.findAllByText('Pastor Patrik Göransson')).length).toBeGreaterThanOrEqual(1)

    // Check that user-tie icon SVG path is rendered for pastor
    const pastorPath = container.querySelector('path[d^="M6.125 7C4.86719"]')
    expect(pastorPath).toBeTruthy()

    // Check that calendar-week icon SVG path is rendered for service times
    const calendarPath = container.querySelector('path[d^="M4.15625 0V0.65625"]')
    expect(calendarPath).toBeTruthy()

    // Check that direction icon SVG path is rendered for featured button
    const directionPath = container.querySelector('path[d^="M2.5625 9.75L3.49219"]')
    expect(directionPath).toBeTruthy()
  })
})
