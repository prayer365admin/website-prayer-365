import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-connection', () => ({
  db: {
    $transaction: vi.fn(async (calls: Array<Promise<unknown>>) => Promise.all(calls)),
    checkIn: { count: vi.fn(), groupBy: vi.fn() },
    event: { count: vi.fn() },
    prayer: { count: vi.fn() },
    donation: { count: vi.fn(), groupBy: vi.fn() },
    userChurch: { count: vi.fn() },
  },
}))

import { db } from '@/utils/db-connection'
import { GET_ANALYTICS, GET_ATTENDANCE_SUMMARY, GET_REGION_SUMMARY } from './analytics'

const from = new Date('2026-09-01T00:00:00Z')
const to = new Date('2026-09-30T00:00:00Z')
const scope = new Set(['c1'])

beforeEach(() => vi.resetAllMocks())

describe('GET_ANALYTICS', () => {
  it('derives metrics from source records and bounds them; active members distinct', async () => {
    vi.mocked(db.checkIn.count).mockResolvedValue(10)
    vi.mocked(db.event.count).mockResolvedValue(2)
    vi.mocked(db.prayer.count).mockResolvedValue(5)
    vi.mocked(db.donation.count).mockResolvedValue(7)
    vi.mocked(db.checkIn.groupBy).mockResolvedValue([
      { user_id: 'u1', _count: { user_id: 2 } },
      { user_id: 'u2', _count: { user_id: 1 } },
    ] as never)

    const res = await GET_ANALYTICS({ churchIds: scope, from, to })
    expect(res).toEqual({
      from,
      to,
      checkInCount: 10,
      eventCount: 2,
      prayerCount: 5,
      donationCount: 7,
      activeMembers: 2,
    })
    expect(db.event.count).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ event_key: expect.anything() }) }),
    )
  })
})

describe('GET_ATTENDANCE_SUMMARY', () => {
  it('aggregates counts by local date only (no named records)', async () => {
    vi.mocked(db.checkIn.groupBy).mockResolvedValue([
      { local_date: new Date('2026-09-05T00:00:00Z'), _count: { _all: 3 } },
      { local_date: new Date('2026-09-06T00:00:00Z'), _count: { _all: 1 } },
    ] as never)

    const res = await GET_ATTENDANCE_SUMMARY({ churchIds: scope, from, to })
    // Only {date, count} pairs — no user, no name, no identity columns.
    expect(res.days).toEqual([
      { date: '2026-09-05', count: 3 },
      { date: '2026-09-06', count: 1 },
    ])
  })
})

describe('GET_REGION_SUMMARY', () => {
  it('aggregates only across the descendant church set (no request/donor detail)', async () => {
    vi.mocked(db.userChurch.count).mockResolvedValue(20)
    vi.mocked(db.checkIn.count).mockResolvedValue(30)
    vi.mocked(db.event.count).mockResolvedValue(4)
    vi.mocked(db.prayer.count).mockResolvedValue(9)
    vi.mocked(db.donation.count).mockResolvedValue(12)
    vi.mocked(db.checkIn.groupBy).mockResolvedValue([
      { user_id: 'u1', _count: { user_id: 1 } },
    ] as never)
    vi.mocked(db.donation.groupBy).mockResolvedValue([
      { currency: 'USD', _sum: { amount_minor: BigInt(3000) } },
      { currency: 'IDR', _sum: { amount_minor: BigInt(150000) } },
    ] as never)

    const res = await GET_REGION_SUMMARY({
      regionId: 'r1',
      churchIds: new Set(['c1', 'c2']),
      from,
      to,
    })
    expect(res.regionId).toBe('r1')
    expect(res.churchCount).toBe(2)
    expect(res.memberCount).toBe(20)
    expect(res.activeMembers).toBe(1)
    expect(res.checkInCount).toBe(30)
    expect(res.eventCount).toBe(4)
    expect(res.prayerCount).toBe(9)
    expect(res.donationCount).toBe(12)
    // Aggregated gross per currency only — no donor/subscription/request fields.
    expect(res.totalGrossByCurrency).toEqual([
      { currency: 'IDR', grossMinor: '150000' },
      { currency: 'USD', grossMinor: '3000' },
    ])
    expect(Object.keys(res).sort()).not.toContain('donors')
    expect(JSON.stringify(res)).not.toMatch(/user_id/i)
  })

  it('returns zeroed aggregates when scope resolves no churches', async () => {
    const res = await GET_REGION_SUMMARY({ regionId: 'r1', churchIds: new Set(), from, to })
    expect(res.churchCount).toBe(0)
    expect(res.memberCount).toBe(0)
    expect(res.totalGrossByCurrency).toEqual([])
  })
})
