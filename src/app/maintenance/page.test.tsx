import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const { getSiteLocale, isMaintenanceEnabled, redirect } = vi.hoisted(() => ({
  getSiteLocale: vi.fn(),
  isMaintenanceEnabled: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return { ...actual, redirect }
})
vi.mock('@/utils/site-locale', () => ({ getSiteLocale }))
vi.mock('@/utils/maintenance', () => ({ isMaintenanceEnabled }))

describe('/maintenance page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSiteLocale.mockResolvedValue('en')
  })

  it('sends a visitor home while the flag is off', async () => {
    isMaintenanceEnabled.mockReturnValue(false)

    await Page()

    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('renders the screen while the flag is on', async () => {
    isMaintenanceEnabled.mockReturnValue(true)

    render(await Page())

    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Something new is coming')
  })
})
