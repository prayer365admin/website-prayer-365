import { describe, expect, it, vi } from 'vitest'
import { applyPerformanceMeasurePatch } from './patch-performance-measure'

describe('applyPerformanceMeasurePatch', () => {
  it('clamps negative start and end timestamps so Chromium does not throw', () => {
    const rawMeasure = vi.fn().mockImplementation((name, opts) => ({
      name,
      entryType: 'measure',
      startTime: opts.start,
      duration: opts.end - opts.start,
      toJSON: () => ({}),
    }))

    const fakePerf = {
      measure: rawMeasure,
    } as unknown as Performance

    applyPerformanceMeasurePatch(fakePerf)

    fakePerf.measure('Page', {
      start: -100,
      end: -50,
    })

    expect(rawMeasure).toHaveBeenCalledWith('Page', { start: 0, end: 0 }, undefined)
  })

  it('safely catches and returns fallback if underlying measure throws', () => {
    const throwingMeasure = vi.fn().mockImplementation(() => {
      throw new TypeError(
        "Failed to execute 'measure' on 'Performance': 'Page' cannot have a negative time stamp.",
      )
    })

    const fakePerf = {
      measure: throwingMeasure,
    } as unknown as Performance

    applyPerformanceMeasurePatch(fakePerf)

    expect(() => {
      fakePerf.measure('Page', { start: -200, end: -100 })
    }).not.toThrow()
  })

  it('does not re-patch an already patched performance instance', () => {
    const rawMeasure = vi.fn()
    const fakePerf = {
      measure: rawMeasure,
    } as unknown as Performance

    applyPerformanceMeasurePatch(fakePerf)
    const firstPatched = fakePerf.measure

    applyPerformanceMeasurePatch(fakePerf)
    expect(fakePerf.measure).toBe(firstPatched)
  })
})
