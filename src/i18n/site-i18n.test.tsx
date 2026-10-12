import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SiteI18nProvider, useSiteI18n } from './site-i18n'

function Probe() {
  const { locale, setLocale, t } = useSiteI18n()

  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t('signOut')}</span>
      <span data-testid="missing">{t('nope' as never)}</span>
      <button onClick={() => setLocale('sv')} type="button">
        switch
      </button>
    </div>
  )
}

describe('SiteI18nProvider', () => {
  it('renders English by default and falls back to the key', () => {
    render(
      <SiteI18nProvider initialLocale="en">
        <Probe />
      </SiteI18nProvider>,
    )

    expect(screen.getByTestId('label').textContent).toBe('Sign out')
    expect(screen.getByTestId('missing').textContent).toBe('nope')
  })

  it('switches language and remembers it in a cookie', () => {
    render(
      <SiteI18nProvider initialLocale="en">
        <Probe />
      </SiteI18nProvider>,
    )

    act(() => screen.getByRole('button', { name: 'switch' }).click())

    expect(screen.getByTestId('locale').textContent).toBe('sv')
    expect(screen.getByTestId('label').textContent).toBe('Logga ut')
    expect(document.cookie).toContain('site_locale=sv')
  })
})
