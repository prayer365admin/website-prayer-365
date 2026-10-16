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
    expect(viewDetailsLinks[0].getAttribute('href')).toBe('/churches/c1')
    expect(screen.getAllByText('G').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByRole('link', { name: 'View prayers' }).getAttribute('href')).toBe(
      '/churches/c1/prayers',
    )
    expect(screen.getByText('2 welcoming congregations listed')).toBeTruthy()

    expect(screen.getAllByText('Hope').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Tartu').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Baptist').length).toBe(2)
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
    expect(await screen.findByText('Primary Parish')).toBeTruthy()
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

    // While debouncing, loading skeletons should be displayed
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)

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
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/churches/c1')

    const pin2 = screen.getByRole('button', { name: 'Pin c2' })
    await user.click(pin2)

    await waitFor(() => {
      expect(pinsContainer.getAttribute('data-active')).toBe('c2')
      expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe(
        '/churches/c2',
      )
    })
  })

  it('toggles quick-filter chips and triggers API fetch with filter flags', async () => {
    const user = userEvent.setup()
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })

    renderDirectory()
    await screen.findAllByText('Grace')

    // Click "Sunday Live Stream" chip
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })
    const sundayChip = screen.getByRole('button', { name: /Sunday Live Stream/i })
    await user.click(sundayChip)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches', {
        params: expect.objectContaining({ sunday_live_stream: true, page: 1 }),
      })
    })

    // Click it again to toggle off
    axiosMock.get.mockResolvedValueOnce({
      data: resolveGet([summaryA], 1),
    })
    await user.click(sundayChip)

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenLastCalledWith('/api/v1/site/churches', {
        params: expect.not.objectContaining({ sunday_live_stream: true }),
      })
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
    const radiusCombo = screen.getByRole('combobox', { name: 'Within 10 km' })
    await user.click(radiusCombo)

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
})
