import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteLocale } from '@/config/site-locale'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import ThankYouVideoOverlay from './thank-you-video-overlay'

const renderWithI18n = (ui: React.ReactElement, locale: SiteLocale = 'et') =>
  render(<SiteI18nProvider initialLocale={locale}>{ui}</SiteI18nProvider>)

describe('ThankYouVideoOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders video element with autoplay, muted, playsInline and correct source', () => {
    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const video = container.querySelector('video')

    expect(video).toBeTruthy()
    expect(video?.getAttribute('src')).toBe('/videos/thankyou.webm')
    expect(video?.muted).toBe(true)
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
  })

  it('displays the storyboard texts across video lifecycle', () => {
    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const video = container.querySelector('video')!

    // Initially at t=0: Panel 1 is shown
    expect(screen.getByText('Hea, et oled siin.')).toBeTruthy()

    // Simulate time advance to 4.0s (Panel 4)
    act(() => {
      Object.defineProperty(video, 'currentTime', { value: 4.0, configurable: true })
      // Run animation frame
      vi.advanceTimersByTime(50)
    })
    expect(screen.getByText(/Aitäh Sinu annetuse eest/)).toBeTruthy()
    expect(screen.getByText(/Jumal õnnistagu Sind/)).toBeTruthy()
    expect(screen.getByText('Sinu headus jõuab edasi.')).toBeTruthy()

    // Simulate time advance to 5.5s (Panel 5)
    act(() => {
      Object.defineProperty(video, 'currentTime', { value: 5.5, configurable: true })
      vi.advanceTimersByTime(50)
    })
    expect(screen.getByText(/PALVETA/)).toBeTruthy()

    // Simulate time advance to 6.5s (Panel 6)
    act(() => {
      Object.defineProperty(video, 'currentTime', { value: 6.5, configurable: true })
      vi.advanceTimersByTime(50)
    })
    expect(screen.getByText(/Iga päev palves/)).toBeTruthy()
    expect(screen.getByText(/ÜKS INIMEES/)).toBeTruthy()
  })

  it('triggers onComplete when skip button is clicked', () => {
    const onComplete = vi.fn()
    renderWithI18n(<ThankYouVideoOverlay onComplete={onComplete} />)

    const skipBtn = screen.getByRole('button', { name: 'Jäta video vahele' })
    fireEvent.click(skipBtn)

    expect(onComplete).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('triggers onComplete when video ends', () => {
    const onComplete = vi.fn()
    const { container } = renderWithI18n(<ThankYouVideoOverlay onComplete={onComplete} />)
    const video = container.querySelector('video')!

    fireEvent.ended(video)

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('renders English text when locale is en', () => {
    renderWithI18n(<ThankYouVideoOverlay />, 'en')
    expect(screen.getByText('Good to have you here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip thank you video' })).toBeTruthy()
  })
})
