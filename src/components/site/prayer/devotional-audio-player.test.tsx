import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() =>
  vi.fn<(url: string, body: unknown) => Promise<object>>(async () => ({})),
)
vi.mock('axios', () => ({ default: { post } }))
import DevotionalAudioPlayer from './devotional-audio-player'

const src = 'https://cdn.test/a/playable.mp3'

describe('DevotionalAudioPlayer (WB-34/35)', () => {
  it('plays the public URL directly: no credentials mode, no auth header path', () => {
    const { container } = render(<DevotionalAudioPlayer prayerId="p1" src={src} />)
    const audio = container.querySelector('audio')!

    expect(audio.getAttribute('src')).toBe(src)
    // Without crossorigin the browser sends a plain request — no cookies or Authorization.
    expect(audio.hasAttribute('crossorigin')).toBe(false)
    expect(screen.getByRole('link', { name: 'Download prayer audio' }).getAttribute('href')).toBe(
      src,
    )
  })

  it('hides the transcript link on the detail page', () => {
    render(<DevotionalAudioPlayer prayerId="p1" showTranscript={false} src={src} />)
    expect(screen.queryByRole('link', { name: /Read transcript/ })).toBeNull()
  })

  it('reports one prayer_listen on the first successful play, not on later plays', async () => {
    const { container } = render(<DevotionalAudioPlayer prayerId="p1" src={src} />)
    const audio = container.querySelector('audio')!
    audio.play = vi.fn(async () => {})
    const button = () => screen.getByRole('button', { name: /^(Play|Pause) prayer audio$/ })

    fireEvent.click(button()) // play
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    Object.defineProperty(audio, 'paused', { configurable: true, value: false })
    fireEvent.click(button()) // pause
    Object.defineProperty(audio, 'paused', { configurable: true, value: true })
    fireEvent.click(button()) // play again
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2))

    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/api/v1/site/analytics-events', {
      events: [expect.objectContaining({ eventType: 'prayer_listen', resourceId: 'p1' })],
    })
  })

  it('reports one prayer_listen_minute per full minute played, at real speed, ignoring seeks', () => {
    post.mockClear()
    const { container } = render(<DevotionalAudioPlayer prayerId="p1" src={src} />)
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'paused', { configurable: true, value: false })
    const at = (time: number, rate = 1) => {
      Object.defineProperty(audio, 'currentTime', {
        configurable: true,
        value: time,
        writable: true,
      })
      audio.playbackRate = rate
      fireEvent.timeUpdate(audio)
    }
    const minuteEvents = () =>
      post.mock.calls.filter(
        ([, body]) =>
          (body as { events: { eventType: string }[] }).events[0].eventType ===
          'prayer_listen_minute',
      )

    for (let t = 0.5; t <= 59.5; t += 0.5) at(t) // 59.5s played
    expect(minuteEvents()).toHaveLength(0)
    at(60) // first full minute
    expect(minuteEvents()).toHaveLength(1)
    at(200) // seek forward: not listening
    at(10) // seek back: not listening
    expect(minuteEvents()).toHaveLength(1)
    for (let t = 10.75; t <= 100; t += 0.75) at(t, 1.5) // 90s of audio at 1.5x = 60s wall clock
    expect(minuteEvents()).toHaveLength(2)

    const keys = minuteEvents().map(
      ([, body]) => (body as { events: { eventKey: string }[] }).events[0].eventKey,
    )
    expect(keys[0]).toMatch(/:1$/)
    expect(keys[1]).toMatch(/:2$/)
    expect(new Set(keys).size).toBe(2)
  })
})
