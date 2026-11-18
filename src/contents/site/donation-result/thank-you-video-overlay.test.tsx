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
    window.localStorage.clear()
  })

  it('renders a silent video plus a separate autoplay soundtrack', () => {
    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const video = container.querySelector('video')
    const audio = container.querySelector('audio')

    expect(video).toBeTruthy()
    expect(video?.getAttribute('src')).toBe('/videos/thankyou.webm')
    expect(video?.hasAttribute('autoplay')).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
    expect(video?.muted).toBe(true)

    expect(audio).toBeTruthy()
    expect(audio?.getAttribute('src')).toBe('/videos/thankyou-opening.mp3')
    expect(audio?.hasAttribute('autoplay')).toBe(true)
  })

  it('tries unmuted soundtrack playback and falls back to muted when the browser blocks it', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      if (this instanceof HTMLAudioElement && !this.muted) {
        return Promise.reject(new Error('NotAllowedError'))
      }
      return Promise.resolve()
    })

    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const video = container.querySelector('video')!
    const audio = container.querySelector('audio')!

    await act(async () => {})

    expect(play).toHaveBeenCalled()
    expect(audio.muted).toBe(true)
    expect(video.muted).toBe(true)

    // Toggle is visible while muted; clicking it unmutes and records the choice.
    fireEvent.click(screen.getByRole('button', { name: 'Lülita video heli sisse' }))

    expect(audio.muted).toBe(false)
    expect(video.muted).toBe(true)
    expect(window.localStorage.getItem('thankyou_video_muted')).toBe('0')
    expect(screen.getByRole('button', { name: 'Lülita video heli välja' })).toBeTruthy()
  })

  it('unmutes on the first interaction after autoplay is blocked', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      if (this instanceof HTMLAudioElement && !this.muted) {
        return Promise.reject(new Error('NotAllowedError'))
      }
      return Promise.resolve()
    })

    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const audio = container.querySelector('audio')!

    await act(async () => {})
    expect(audio.muted).toBe(true)

    fireEvent.keyDown(window, { key: 'Enter' })

    expect(audio.muted).toBe(false)
    // Auto-unlock is not an explicit preference.
    expect(window.localStorage.getItem('thankyou_video_muted')).toBeNull()
  })

  it('does not auto-unmute from an interaction inside the sound controls', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      if (this instanceof HTMLAudioElement && !this.muted) {
        return Promise.reject(new Error('NotAllowedError'))
      }
      return Promise.resolve()
    })

    renderWithI18n(<ThankYouVideoOverlay />)
    await act(async () => {})

    fireEvent.keyDown(screen.getByRole('button', { name: 'Lülita video heli sisse' }), {
      key: 'Enter',
    })

    expect(screen.getByRole('button', { name: 'Lülita video heli sisse' })).toBeTruthy()
  })

  it('stays muted when the visitor muted before', () => {
    window.localStorage.setItem('thankyou_video_muted', '1')
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const audio = container.querySelector('audio')!

    expect(audio.muted).toBe(true)
    expect(screen.getByRole('button', { name: 'Lülita video heli sisse' })).toBeTruthy()
  })

  it('mutes and persists the choice when the visitor turns sound off', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    const { container } = renderWithI18n(<ThankYouVideoOverlay />)
    const audio = container.querySelector('audio')!
    await act(async () => {})

    expect(audio.muted).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Lülita video heli välja' }))

    expect(audio.muted).toBe(true)
    expect(window.localStorage.getItem('thankyou_video_muted')).toBe('1')
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

  it('triggers onComplete when the soundtrack ends', () => {
    const onComplete = vi.fn()
    const { container } = renderWithI18n(<ThankYouVideoOverlay onComplete={onComplete} />)
    const audio = container.querySelector('audio')!

    fireEvent.ended(audio)

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps the overlay up when the shorter visual track ends', () => {
    const onComplete = vi.fn()
    const { container } = renderWithI18n(<ThankYouVideoOverlay onComplete={onComplete} />)
    const video = container.querySelector('video')!

    fireEvent.ended(video)

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByText(/Iga päev palves/)).toBeTruthy()
  })

  it('renders English text when locale is en', () => {
    renderWithI18n(<ThankYouVideoOverlay />, 'en')
    expect(screen.getByText('Good to have you here.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip thank you video' })).toBeTruthy()
  })
})
