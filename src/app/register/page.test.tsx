import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

const cookies = vi.hoisted(() => vi.fn())
vi.mock('next/headers', () => ({ cookies }))

describe('Register route page', () => {
  it('renders the customer sign-up wizard in the cookie language', async () => {
    cookies.mockResolvedValue({ get: () => ({ value: 'fi' }) })

    renderWithProviders(await Page())

    expect(
      screen.getByRole('heading', { level: 1, name: SITE_MESSAGES.fi.signUpTitle }),
    ).toBeTruthy()
    expect(screen.getByLabelText(SITE_MESSAGES.fi.signUpNameLabel)).toBeTruthy()
  })
})
