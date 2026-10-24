import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  analyticsEvent: { count: vi.fn(), findMany: vi.fn() },
}))
vi.mock('@/utils/db-connection', () => ({ db }))

import { GET_MY_HABITS, streakDays, weekStart } from './site-habits'

describe('streakDays', () => {
  it('counts consecutive days ending today', () => {
    expect(streakDays(['2026-10-17', '2026-10-16', '2026-10-15', '2026-10-13'], '2026-10-17')).toBe(
      3,
    )
  })

  it('keeps a streak that ended yesterday (today has not listened yet)', () => {
    expect(streakDays(['2026-10-16', '2026-10-15'], '2026-10-17')).toBe(2)
  })

  it('is zero after a missed day or with no listens', () => {
    expect(streakDays(['2026-10-15', '2026-10-14'], '2026-10-17')).toBe(0)
    expect(streakDays([], '2026-10-17')).toBe(0)
  })

  it('crosses month boundaries', () => {
    expect(streakDays(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01')).toBe(3)
  })
})

describe('weekStart', () => {
  it('returns Monday 00:00 UTC, including on Sunday and Monday', () => {
    expect(weekStart(new Date('2026-10-17T15:00:00Z')).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    ) // Sat
    expect(weekStart(new Date('2026-10-18T23:00:00Z')).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    ) // Sun
    expect(weekStart(new Date('2026-10-12T00:00:00Z')).toISOString()).toBe(
      '2026-10-12T00:00:00.000Z',
    ) // Mon
  })
})

describe('GET_MY_HABITS', () => {
  beforeEach(() => vi.clearAllMocks())

  it("reads only the caller's prayer-listening days and this week's listened minutes", async () => {
    db.analyticsEvent.findMany.mockResolvedValue([
      { occurred_at: new Date('2026-10-17T08:00:00Z') },
      { occurred_at: new Date('2026-10-17T07:00:00Z') },
      { occurred_at: new Date('2026-10-16T20:00:00Z') },
    ])
    db.analyticsEvent.count.mockResolvedValue(48)

    const habits = await GET_MY_HABITS({ userId: 'u1', now: new Date('2026-10-17T10:00:00Z') })

    expect(habits).toEqual({ streakDays: 2, minutesThisWeek: 48 })
    expect(db.analyticsEvent.findMany.mock.calls[0][0]).toEqual({
      where: {
        user_id: 'u1',
        event_type: 'prayer_listen',
        occurred_at: {
          gte: new Date('2025-10-16T10:00:00.000Z'),
          lte: new Date('2026-10-17T10:00:00.000Z'),
        },
      },
      orderBy: { occurred_at: 'desc' },
      select: { occurred_at: true },
    })
    expect(db.analyticsEvent.count.mock.calls[0][0]).toEqual({
      where: {
        user_id: 'u1',
        event_type: 'prayer_listen_minute',
        occurred_at: {
          gte: new Date('2026-10-12T00:00:00Z'),
          lte: new Date('2026-10-17T10:00:00Z'),
        },
      },
    })
  })
})
