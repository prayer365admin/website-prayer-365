import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WelcomeComingSoon from './coming-soon'

describe('WelcomeComingSoon', () => {
  it('renders the copy and keeps the #app-promo anchor the hero links to', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <WelcomeComingSoon />
      </SiteI18nProvider>,
    )

    const section = screen.getByLabelText(SITE_MESSAGES.en.welcomeSoonSectionAria)
    expect(section.getAttribute('id')).toBe('app-promo')
    expect(screen.getByRole('heading', { name: SITE_MESSAGES.en.welcomeSoonTitle })).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.welcomeSoonBadge)).toBeTruthy()
    expect(screen.getByText(SITE_MESSAGES.en.welcomeSoonBody)).toBeTruthy()
    expect(screen.getByAltText(SITE_MESSAGES.en.welcomeSoonPhonesAlt)).toBeTruthy()
    // The notify form is hidden for now.
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
