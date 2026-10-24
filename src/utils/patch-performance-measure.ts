/**
 * Monkey-patches window.performance.measure in browser environments to prevent
 * the React 19 / Next.js Server Components profiler instrumentation bug:
 * "TypeError: Failed to execute 'measure' on 'Performance': 'Page' cannot have a negative time stamp."
 *
 * In Next.js dev mode with React 19 Server Components, when a page redirects or
 * errors mid-stream, React's flushComponentPerformance calculates an unclamped
 * negative end timestamp and calls performance.measure, causing Chromium to throw.
 * (React issue #37561, Next.js issue #99032 / #86060).
 */

interface PatchablePerformance extends Performance {
  __perfMeasurePatched?: boolean
}

export function applyPerformanceMeasurePatch(perf: Performance = window.performance): void {
  if (!perf || typeof perf.measure !== 'function') {
    return
  }

  const patchable = perf as PatchablePerformance
  if (patchable.__perfMeasurePatched) {
    return
  }

  const origMeasure = perf.measure.bind(perf)

  perf.measure = function (
    name: string,
    startOrOptions?: string | PerformanceMeasureOptions,
    endMark?: string,
  ): PerformanceMeasure {
    if (startOrOptions && typeof startOrOptions === 'object') {
      const opts: PerformanceMeasureOptions = { ...startOrOptions }
      if (typeof opts.start === 'number' && opts.start < 0) {
        opts.start = 0
      }
      if (typeof opts.end === 'number' && opts.end < 0) {
        opts.end = 0
      }
      try {
        return origMeasure(name, opts, endMark)
      } catch {
        // SAFETY: Fallback mock PerformanceMeasure object when browser rejects negative timing
        return {} as PerformanceMeasure
      }
    }
    try {
      return origMeasure(name, startOrOptions, endMark)
    } catch {
      // SAFETY: Fallback mock PerformanceMeasure object when browser rejects invalid mark/timing
      return {} as PerformanceMeasure
    }
  }

  patchable.__perfMeasurePatched = true
}

if (typeof window !== 'undefined' && window.performance) {
  applyPerformanceMeasurePatch(window.performance)
}
