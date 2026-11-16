// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  nextSendAt,
  sequenceFor,
  tallinnLocalToUtc,
  todayInTallinn,
} from './general-prayer-cycle'

/*
 * Cycle maths is the whole 365-day programme's correctness: the wrong position
 * publishes (and speaks) a different prayer, and the wrong local hour sends at
 * the wrong time twice a year. Every branch is asserted with injected dates.
 */

const ANCHOR = '2026-11-12'
const COUNT = 10

describe('sequenceFor', () => {
  it('starts at 1 on the anchor date and advances one position per day', () => {
    expect(sequenceFor(ANCHOR, COUNT)).toBe(1)
    expect(sequenceFor('2026-11-13', COUNT)).toBe(2)
    expect(sequenceFor('2026-11-14', COUNT)).toBe(3)
    expect(sequenceFor('2026-11-21', COUNT)).toBe(COUNT)
  })

  it('wraps to 1 after the last position', () => {
    expect(sequenceFor('2026-11-22', COUNT)).toBe(1)
    expect(sequenceFor('2026-12-02', COUNT)).toBe(1)
  })

  it('wraps backwards before the anchor', () => {
    expect(sequenceFor('2026-11-11', COUNT)).toBe(COUNT)
    expect(sequenceFor('2026-11-10', COUNT)).toBe(COUNT - 1)
    expect(sequenceFor('2026-10-30', COUNT)).toBe(8)
  })

  it('treats 29 February as an ordinary day', () => {
    // 474 days after the anchor => position 5 (474 mod 10 = 4).
    expect(daysBetween(ANCHOR, '2028-02-29')).toBe(474)
    expect(sequenceFor('2028-02-29', COUNT)).toBe(5)
    expect(sequenceFor('2028-02-28', COUNT)).toBe(4)
    expect(sequenceFor('2028-03-01', COUNT)).toBe(6)
  })

  it('returns exactly one position on both DST change days', () => {
    // Europe/Tallinn springs forward 03:00 on 2027-03-28 and falls back on 2026-10-25.
    for (const dstDay of ['2027-03-28', '2026-10-25']) {
      const position = sequenceFor(dstDay, COUNT)
      expect(Number.isInteger(position)).toBe(true)
      expect(position).toBeGreaterThanOrEqual(1)
      expect(position).toBeLessThanOrEqual(COUNT)
      // The clock change neither consumes nor duplicates a day, so the next
      // calendar day is exactly one position on (wrapping back to 1).
      const next = sequenceFor(addDays(dstDay, 1), COUNT)
      expect(next).toBe(position === COUNT ? 1 : position + 1)
    }
  })

  it('supports any cycle length, including a single-entry cycle', () => {
    expect(sequenceFor('2026-11-12', 1)).toBe(1)
    expect(sequenceFor('2030-01-01', 1)).toBe(1)
    // A full-year cycle: the anchor is 1, day 365 is the last position, and the
    // next day after the anchor year restarts the cycle.
    expect(sequenceFor('2026-11-12', 365)).toBe(1)
    expect(sequenceFor('2027-11-11', 365)).toBe(365)
    expect(sequenceFor('2027-11-12', 365)).toBe(1)
  })

  it('rejects a non-positive or non-integer cycle length and a malformed date', () => {
    expect(() => sequenceFor(ANCHOR, 0)).toThrow()
    expect(() => sequenceFor(ANCHOR, -3)).toThrow()
    expect(() => sequenceFor(ANCHOR, 2.5)).toThrow()
    expect(() => sequenceFor('2026-13-01', COUNT)).toThrow()
    expect(() => sequenceFor('26-11-12', COUNT)).toThrow()
    // A date that does not exist (2026 is not a leap year) must not silently roll over.
    expect(() => sequenceFor('2026-02-29', COUNT)).toThrow()
  })
})

describe('todayInTallinn', () => {
  it('reports the local calendar date and hour, not UTC', () => {
    // 04:30 UTC is 06:30 in November (EET, +2).
    expect(todayInTallinn(new Date('2026-11-13T04:30:00.000Z'))).toEqual({
      dateISO: '2026-11-13',
      hour: 6,
    })
    // 22:30 UTC is already the next day in Tallinn.
    expect(todayInTallinn(new Date('2026-11-13T22:30:00.000Z'))).toEqual({
      dateISO: '2026-11-14',
      hour: 0,
    })
    // Summer time is +3, so 21:30 UTC is 00:30 on the next day.
    expect(todayInTallinn(new Date('2027-07-01T21:30:00.000Z'))).toEqual({
      dateISO: '2027-07-02',
      hour: 0,
    })
  })
})

describe('tallinnLocalToUtc', () => {
  it('maps 07:00 local to the correct UTC instant on both sides of DST', () => {
    expect(tallinnLocalToUtc('2026-11-12', 7).toISOString()).toBe('2026-11-12T05:00:00.000Z')
    expect(tallinnLocalToUtc('2027-07-01', 7).toISOString()).toBe('2027-07-01T04:00:00.000Z')
  })
})

describe('nextSendAt', () => {
  it('is today’s send before the hour and tomorrow’s after it', () => {
    expect(nextSendAt(new Date('2026-11-12T03:59:00.000Z')).toISOString()).toBe(
      '2026-11-12T05:00:00.000Z',
    )
    expect(nextSendAt(new Date('2026-11-12T05:01:00.000Z')).toISOString()).toBe(
      '2026-11-13T05:00:00.000Z',
    )
    // Exactly at the boundary counts as "already sent today".
    expect(nextSendAt(new Date('2026-11-12T05:00:00.000Z')).toISOString()).toBe(
      '2026-11-13T05:00:00.000Z',
    )
  })
})

describe('calendar helpers', () => {
  it('counts whole days in both directions', () => {
    expect(daysBetween(ANCHOR, '2026-11-21')).toBe(9)
    expect(daysBetween(ANCHOR, ANCHOR)).toBe(0)
    expect(daysBetween('2026-11-21', ANCHOR)).toBe(-9)
  })

  it('shifts dates across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })
})
