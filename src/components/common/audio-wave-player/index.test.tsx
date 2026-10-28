import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AudioWavePlayer from '.'

describe('AudioWavePlayer', () => {
  it('provides reusable waveform playback, speed, seeking, and download controls', () => {
    const onDuration = vi.fn()
    const { container } = renderWithProviders(
      <AudioWavePlayer
        label="Sample 1"
        onDuration={onDuration}
        seed="sample-1"
        src="https://media.example/sample.mp3"
      />,
    )
    const audio = container.querySelector('audio') as HTMLAudioElement
    Object.defineProperty(audio, 'duration', { configurable: true, value: 19 })
    fireEvent.loadedMetadata(audio)

    expect(screen.getByText('0:00 / 0:19')).toBeTruthy()
    expect(onDuration).toHaveBeenCalledWith(19)
    expect(screen.getByRole('button', { name: 'Play Sample 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play Sample 1' }).querySelector('img')).toBeNull()
    expect(screen.getByRole('slider', { name: 'Sample 1 audio position' })).toBeTruthy()
    const download = screen.getByRole('link', { name: 'Download Sample 1' })
    expect(download.getAttribute('href')).toBe('https://media.example/sample.mp3')
    expect(download.querySelector('img')).toBeNull()
    expect(download.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 20 20')

    fireEvent.play(audio)
    const pauseButton = screen.getByRole('button', { name: 'Pause Sample 1' })
    expect(pauseButton.querySelector('img')).toBeNull()
    expect(pauseButton.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 11 20')

    const rateButton = screen.getByRole('button', { name: 'Sample 1 playback speed 1 times' })
    expect(rateButton.querySelector('img')).toBeNull()
    expect(rateButton.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 20 20')
    fireEvent.click(rateButton)
    expect(screen.getByRole('button', { name: 'Sample 1 playback speed 1.25 times' })).toBeTruthy()
  })
})
