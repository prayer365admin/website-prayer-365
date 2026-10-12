import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useCountries = vi.hoisted(() => vi.fn())
const useLanguages = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/data/central', () => ({ useCountries, useLanguages }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    createAny: () => ({ granted: true }),
    updateAny: () => ({ granted: true }),
  }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}))

import ContentsCentralRegistry from './index'

const registry = (data: unknown[], onUpdate = vi.fn()) => ({
  data,
  loading: false,
  saving: false,
  error: null,
  onCreate: vi.fn(),
  onUpdate,
})

describe('ContentsCentralRegistry', () => {
  beforeEach(() => vi.clearAllMocks())

  const languages = [
    { code: 'et', name: 'Estonian', enabled: false, version: 2, ready: true },
    { code: 'sv', name: 'Swedish', enabled: false, version: 1, ready: false },
    { code: 'en', name: 'English', enabled: true, version: 1, ready: true },
  ]

  it('shows status as Active/Inactive tags instead of switches', () => {
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry(languages))
    renderWithProviders(<ContentsCentralRegistry kind="language" />)

    expect(screen.getAllByText('Inactive')).toHaveLength(2)
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Not ready')).toBeTruthy()
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('searches by name or code', async () => {
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry(languages))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralRegistry kind="language" />)

    await user.type(screen.getByPlaceholderText('Search by name or code'), 'sv{Enter}')
    expect(screen.getByText('Swedish')).toBeTruthy()
    expect(screen.queryByText('Estonian')).toBeNull()

    await user.clear(screen.getByPlaceholderText('Search by name or code'))
    await user.type(screen.getByPlaceholderText('Search by name or code'), 'engl{Enter}')
    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.queryByText('Swedish')).toBeNull()
  })

  it('filters by status and translation readiness', async () => {
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry(languages))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralRegistry kind="language" />)

    const [status, translations] = screen.getAllByRole('combobox')
    await user.click(status)
    await user.click(await screen.findByTitle('Inactive'))
    expect(screen.queryByText('English')).toBeNull()
    expect(screen.getByText('Estonian')).toBeTruthy()

    await user.click(translations)
    await user.click(await screen.findByTitle('Not ready'))
    expect(screen.queryByText('Estonian')).toBeNull()
    expect(screen.getByText('Swedish')).toBeTruthy()
  })

  it('blocks activating a not-ready language in the drawer', async () => {
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry(languages))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralRegistry kind="language" />)

    const rows = screen.getAllByRole('button', { name: 'Edit' })
    await user.click(rows[1]) // Swedish
    const toggle = await screen.findByRole('switch', { name: 'Active' })
    expect(toggle.hasAttribute('disabled')).toBe(true)
    expect(
      screen.getByText('This language can be activated once its translations are ready.'),
    ).toBeTruthy()
  })

  it('activates a ready language from the drawer with its version', async () => {
    const onUpdate = vi.fn()
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry(languages, onUpdate))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralRegistry kind="language" />)

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]) // Estonian
    await user.click(await screen.findByRole('switch', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        code: 'et',
        payload: { version: 2, name: 'Estonian', enabled: true },
      }),
    )
  })

  it('deactivates a referenced country from the drawer and offers no delete', async () => {
    const onUpdate = vi.fn()
    useCountries.mockReturnValue(
      registry([{ code: 'EE', name: 'Estonia', enabled: true, version: 3 }], onUpdate),
    )
    useLanguages.mockReturnValue(registry([]))
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralRegistry kind="country" />)

    expect(screen.getAllByRole('combobox')).toHaveLength(1) // no translations filter
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(await screen.findByRole('switch', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        code: 'EE',
        payload: { version: 3, name: 'Estonia', enabled: false },
      }),
    )
    expect(screen.queryByRole('button', { name: /delete|remove/i })).toBeNull()
  })
})
