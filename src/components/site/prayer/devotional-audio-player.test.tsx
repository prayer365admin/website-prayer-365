import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
