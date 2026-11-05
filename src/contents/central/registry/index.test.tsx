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

  it('shows status as Active/Inactive pills instead of switches', () => {
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
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
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
    const codeInput = (await screen.findByDisplayValue('EE')) as HTMLInputElement
    expect(codeInput.disabled).toBe(true)
    await user.click(await screen.findByRole('switch', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        code: 'EE',
        payload: { version: 3, name: 'Estonia', enabled: false },
      }),
    )
    expect(screen.queryByRole('button', { name: /delete|remove/i })).toBeNull()
  })

  it('renders a flag derived from the ISO code next to each country name', () => {
    useCountries.mockReturnValue(
      registry([{ code: 'EE', name: 'Estonia', enabled: true, version: 3 }]),
    )
    useLanguages.mockReturnValue(registry([]))
    renderWithProviders(<ContentsCentralRegistry kind="country" />)

    const flag = screen.getByRole('img', { name: 'Estonia' }) as HTMLImageElement
    expect(flag.getAttribute('src')).toContain('/h80/ee.png')
    expect(screen.getByText('EE')).toBeTruthy()
    expect(screen.getByText('Estonia')).toBeTruthy()
  })

  it('paints active and inactive status pills differently', () => {
    useCountries.mockReturnValue(
      registry([
        { code: 'EE', name: 'Estonia', enabled: true, version: 3 },
        { code: 'FI', name: 'Finland', enabled: false, version: 1 },
      ]),
    )
    useLanguages.mockReturnValue(registry([]))
    renderWithProviders(<ContentsCentralRegistry kind="country" />)

    const active = screen.getByText('Active').closest('span')
    const inactive = screen.getByText('Inactive').closest('span')
    expect(active?.className).toContain('text-[#09A97C]')
    expect(inactive?.className).toContain('text-[#B0B6BF]')
  })

  it('does not offer country creation from the countries list', () => {
    useCountries.mockReturnValue(registry([]))
    useLanguages.mockReturnValue(registry([]))
    renderWithProviders(<ContentsCentralRegistry kind="country" />)

    expect(screen.queryByRole('button', { name: /add country/i })).toBeNull()
  })
})
