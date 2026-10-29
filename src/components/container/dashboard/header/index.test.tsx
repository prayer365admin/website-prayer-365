import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MainHeader from '.'

const m = vi.hoisted(() => ({ useCurrentChurch: vi.fn(), useChurches: vi.fn() }))

vi.mock('@/hooks/data/church', () => ({
  useCurrentChurch: m.useCurrentChurch,
  useChurches: m.useChurches,
}))

describe('MainHeader church label', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReset()
    m.useChurches.mockReturnValue({ data: undefined, loading: false })
  })

  it('shows a profile loading state until the session is available', () => {
    sessionMock.mockReturnValue({ data: null, status: 'loading' })
    m.useCurrentChurch.mockReturnValue({ data: undefined, loading: false })

    renderWithProviders(<MainHeader />)

    expect(screen.getByRole('status', { name: 'Loading user profile' })).toBeTruthy()
    expect(screen.queryByText('Staff Member')).toBeNull()
  })

  it('uses a neutral label when the route church is not assigned', () => {
    m.useCurrentChurch.mockReturnValue({ data: undefined, loading: false })

    renderWithProviders(<MainHeader />)

    expect(screen.getByText('Select church')).toBeTruthy()
    expect(screen.queryByText('Loading...')).toBeNull()
  })

  it('shows the route church name without loading the picker list', () => {
    m.useCurrentChurch.mockReturnValue({ data: { id: 'c1', name: 'Grace' }, loading: false })

    renderWithProviders(<MainHeader />)

    expect(screen.getByText('Grace')).toBeTruthy()
    expect(m.useCurrentChurch).toHaveBeenCalledWith('c1')
    expect(m.useChurches).toHaveBeenLastCalledWith(expect.objectContaining({ enableFetch: false }))
  })

  it('loads the picker list on first open', () => {
    m.useCurrentChurch.mockReturnValue({ data: { id: 'c1', name: 'Grace' }, loading: false })

    renderWithProviders(<MainHeader />)
    fireEvent.click(screen.getByText('Grace'))

    expect(m.useChurches).toHaveBeenLastCalledWith(expect.objectContaining({ enableFetch: true }))
  })
})
