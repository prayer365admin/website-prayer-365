import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import * as csvUtil from '@/utils/csv'
import ContentsCustomer from './index'
const customers = [
  {
    id: 'c1',
    name: 'Alice',
    email: 'alice@x.com',
    email_verified_at: '2026-01-01T00:00:00Z',
    last_login_provider: 'google',
    last_active_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'c2',
    name: 'Bob',
    email: 'bob@x.com',
    email_verified_at: null,
    last_login_provider: 'password',
    created_at: '2026-01-02T00:00:00Z',
  },
]

describe('ContentsCustomer', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('renders customer rows and header with user management design', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 2) })
    renderWithProviders(<ContentsCustomer />)
    expect(await screen.findByText('Alice')).toBeTruthy()
    expect(screen.getByText('Customer Management')).toBeTruthy()
    expect(screen.getByText('bob@x.com')).toBeTruthy()
    expect(screen.getByText('Google')).toBeTruthy()
    expect(screen.getByText('Email & Password')).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.getByText('Unverified')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search customer or email...')).toBeTruthy()
    expect(screen.getByText('All Statuses')).toBeTruthy()
    expect(screen.getByRole('button', { name: /export/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy()
  })

  it('revalidates the list and shows a pending state while refetching', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 2) })
    renderWithProviders(<ContentsCustomer />)
    await screen.findByText('Alice')

    const held = Promise.withResolvers<unknown>()
    axiosMock.get.mockImplementation(() => held.promise)

    const refresh = screen.getByRole('button', { name: /refresh/i })
    const callsBefore = axiosMock.get.mock.calls.length
    fireEvent.click(refresh)

    await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('true'))
    expect((refresh as HTMLButtonElement).disabled).toBe(true)
    expect(axiosMock.get.mock.calls.length).toBeGreaterThan(callsBefore)

    held.resolve({ data: resolveGet(customers, 2) })
    await waitFor(() => expect(refresh.getAttribute('aria-busy')).toBe('false'))
    expect((refresh as HTMLButtonElement).disabled).toBe(false)
    expect(await screen.findByText('Alice')).toBeTruthy()
  })

  it('exports customer records to CSV when clicking export button', async () => {
    const exportSpy = vi.spyOn(csvUtil, 'exportToCsv').mockImplementation(() => {})
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 2) })
    renderWithProviders(<ContentsCustomer />)
    await screen.findByText('Alice')

    const exportBtn = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(exportSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^customers-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.any(Array),
        expect.arrayContaining([expect.objectContaining({ name: 'Alice' })]),
      )
    })

    exportSpy.mockRestore()
  })
})
