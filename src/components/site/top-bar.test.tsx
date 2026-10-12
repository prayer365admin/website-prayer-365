import { SiteI18nProvider } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SiteTopBar from './top-bar'

describe('SiteTopBar', () => {
  it('shows the brand, the four-locale switch and the sign-out action', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <SiteTopBar />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('PRAYER')).toBeTruthy()
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
  })
})
