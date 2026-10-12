import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SITE_MESSAGES } from '@/i18n/messages'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import PasswordStrength, { scorePassword } from './password-strength'
import SignInAside from './sign-in-aside'
import SignUpAside from './sign-up-aside'
import StepHeader from './step-header'

const en = SITE_MESSAGES.en
const renderEn = (ui: ReactNode) =>
  renderWithProviders(<SiteI18nProvider initialLocale="en">{ui}</SiteI18nProvider>)

describe('scorePassword', () => {
  it.each([
    ['', 0],
    ['Ab1!', 1], // short is always 1, whatever it contains
    ['password', 1],
    ['Password', 2],
    ['Password1', 3],
    ['Password1!', 4],
  ])('%j scores %i', (password, score) => {
    expect(scorePassword(password)).toBe(score)
  })
})

describe('PasswordStrength', () => {
  it('fills one bar per point and names the level', () => {
    renderEn(<PasswordStrength password="Password1" />)

    const meter = screen.getByRole('meter')
    expect(meter.getAttribute('aria-valuenow')).toBe('3')
    expect(screen.getByText(`Key strength: ${en.passwordStrength3}`)).toBeTruthy()
    expect(screen.getByText(en.passwordHint)).toBeTruthy()
  })
})

describe('StepHeader', () => {
  it('shows the step number and title as a heading', () => {
    renderEn(<StepHeader step={2} title="Parish Connection" />)

    expect(screen.getByRole('heading', { name: /2\s*Parish Connection/ })).toBeTruthy()
  })
})

describe('auth asides (hardcoded, F2)', () => {
  it('sign-in aside renders the stream, reminder and seal cards', () => {
    renderEn(<SignInAside />)

    expect(screen.getByText(en.liveWhisperTitle)).toBeTruthy()
    expect(screen.getByText(en.bellPill)).toBeTruthy()
    expect(screen.getByText(en.sealTitle)).toBeTruthy()
    // Decorative player: nothing clickable pretends to play audio.
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('sign-up aside renders the journey, stats and church photo', () => {
    renderEn(<SignUpAside />)

    expect(screen.getByText(en.journeyTitle)).toBeTruthy()
    expect(screen.getByText(en.signUpQuote)).toBeTruthy()
    expect(screen.getByText(en.vespersValue)).toBeTruthy()
    expect(screen.getByAltText(en.photoCaption)).toBeTruthy()
  })
})
