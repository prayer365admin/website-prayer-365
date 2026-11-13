import { SiteI18nProvider } from '@/i18n/site-i18n'
import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import WelcomePrayerPlayer from './prayer-player'

/*
 * Regression: `loadedmetadata` can complete before React attaches its listeners, so
 * `duration` used to stay 0 — the audio played while the card sat on the first bar.
 * jsdom has no media pipeline, so drive the element directly: give it a duration and
 * a currentTime, then fire the event React actually listens to.
 */
const mount = (props: Partial<Parameters<typeof WelcomePrayerPlayer>[0]> = {}) => {
  const utils = renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <WelcomePrayerPlayer
        audioUrl="https://cdn.test/general/paivapalve-2.mp3"
        title="Prayer"
        {...props}
      />
    </SiteI18nProvider>,
  )
  const audio = utils.container.querySelector('audio') as HTMLAudioElement
  return { ...utils, audio }
}

const prime = (audio: HTMLAudioElement, currentTime: number, duration: number) => {
  let time = currentTime
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => duration })
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => time,
    set: (value: number) => {
      time = value
    },
  })
}

describe('welcome prayer player progress', () => {
  it('moves the progress when the element reports it, even without loadedmetadata', () => {
    const { audio, container } = mount()
    prime(audio, 12.5, 25)
    fireEvent.timeUpdate(audio)

    // The sr-only line carries the real clock, so it proves duration reached state.
    expect(screen.getByText('0:12 of 0:25')).toBeTruthy()
    const track = container.querySelector('div[style*="width"]') as HTMLElement
    expect(track.getAttribute('style')).toBe('width: 50%;')
  })

  it('keeps the first bar unplayed until playback actually starts', () => {
    const { audio, container } = mount()
    prime(audio, 0, 25)
    fireEvent.timeUpdate(audio)

    const bars = Array.from(container.querySelectorAll('span.flex-1.rounded-full'))
    expect(bars).toHaveLength(76)
    expect(bars.filter((bar) => bar.className.includes('2F7AD2'))).toHaveLength(1)
  })
})
