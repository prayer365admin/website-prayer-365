import { describe, expect, it } from 'vitest'
import { waveformBars } from './audio-waveform'

/*
 * The bars are decorative, so the only contracts that matter are: deterministic
 * (server and client must render the same shape), variation per seed (each prayer
 * looks like its own recording instead of every card sharing one sine), and inside
 * the caller's height range.
 */
describe('waveformBars', () => {
  it('returns the same shape for the same seed', () => {
    const first = waveformBars({ count: 76, seed: 'paivapalve-2' })
    const second = waveformBars({ count: 76, seed: 'paivapalve-2' })

    expect(second).toEqual(first)
  })

  it('gives different prayers different shapes', () => {
    const a = waveformBars({ count: 32, seed: 'paivapalve-2' })
    const b = waveformBars({ count: 32, seed: 'paivapalve-3' })

    expect(b).not.toEqual(a)
  })

  it('stays inside the requested height range', () => {
    const bars = waveformBars({ count: 96, min: 5, range: 35, seed: 'asset-1' })

    expect(bars).toHaveLength(96)
    for (const height of bars) {
      expect(height).toBeGreaterThanOrEqual(5)
      expect(height).toBeLessThanOrEqual(40)
      expect(Number.isFinite(height)).toBe(true)
    }
  })
})
