import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  church: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  userChurch: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
  prayer: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  prayerVersion: { findMany: vi.fn(), findFirst: vi.fn() },
  event: { count: vi.fn(), findMany: vi.fn() },
  announcement: { count: vi.fn(), findMany: vi.fn() },
  checkIn: { createMany: vi.fn(), findFirst: vi.fn() },
  analyticsEvent: { createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { churchLocalDate, CREATE_CHECKIN, UPDATE_ME_PROFILE } from './mobile'

beforeEach(() => vi.clearAllMocks())

describe('churchLocalDate (D7 local-day foundation)', () => {
  it('returns a UTC calendar date for a UTC church', () => {
    expect(churchLocalDate(new Date('2026-01-02T23:30:00.000Z'), 'UTC')).toBe('2026-01-02')
  })

  it('returns a different local date for a non-UTC timezone', () => {
    // 2026-01-02T23:30Z in Asia/Makassar (+08) is 2026-01-03
    expect(churchLocalDate(new Date('2026-01-02T23:30:00.000Z'), 'Asia/Makassar')).toBe(
      '2026-01-03',
    )
  })

  it('falls back to UTC on an invalid timezone', () => {
    expect(churchLocalDate(new Date('2026-01-02T10:00:00.000Z'), 'Not/AZone')).toBe('2026-01-02')
  })
})

describe('CREATE_CHECKIN — D7 dedupe (one user/church/local-day)', () => {
  it('builds a deterministic dedupe_key and reuses an existing row on duplicate', async () => {
    db.church.findFirst.mockResolvedValue({ id: 'c1', timezone: 'UTC' })
    db.checkIn.createMany.mockResolvedValue({ count: 0 })
    db.checkIn.findFirst.mockResolvedValue({
      id: 'existing-ck',
      church_id: 'c1',
      user_id: 'u1',
      occurred_at: new Date('2026-01-01T00:00:00Z'),
      local_date: new Date('2026-01-01'),
    })
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'))

    const res = await CREATE_CHECKIN({ churchId: 'c1', userId: 'u1', requestId: 'r' })

    // Dedupe key is user/church/local-date; duplicate returns the existing row => idempotent
    expect(db.checkIn.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.objectContaining({ dedupe_key: 'u1:c1:2026-01-01' }),
      }),
    )
    expect(res.id).toBe('existing-ck')
    expect(res.localDate).toBe('2026-01-01')
    vi.useRealTimers()
  })

  it('returns the freshly inserted row when this is a first check-in', async () => {
    db.church.findFirst.mockResolvedValue({ id: 'c1', timezone: 'UTC' })
    db.checkIn.createMany.mockResolvedValue({ count: 1 })
    db.checkIn.findFirst.mockResolvedValue({
      id: 'new-ck',
      church_id: 'c1',
      user_id: 'u1',
      occurred_at: new Date('2026-01-01T12:00:00Z'),
      local_date: new Date('2026-01-01'),
    })
    const res = await CREATE_CHECKIN({ churchId: 'c1', userId: 'u1', requestId: 'r' })
    expect(res.id).toBe('new-ck')
  })

  it('throws 404 for a non-approved church', async () => {
    db.church.findFirst.mockResolvedValue(null)
    await expect(
      CREATE_CHECKIN({ churchId: 'c-suspended', userId: 'u1', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('UPDATE_ME_PROFILE — main-church is exactly one row', () => {
  const tx = {
    user: { update: vi.fn() },
    church: { findFirst: vi.fn() },
    userChurch: { updateMany: vi.fn(), upsert: vi.fn() },
  }

  it('clears prior is_main flags then sets the new main church inside one transaction', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    tx.church.findFirst.mockResolvedValue({ id: 'c2' })

    await UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: 'c2' })

    expect(tx.userChurch.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      data: { is_main: false },
    })
    expect(tx.userChurch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { user_id_church_id: { user_id: 'u1', church_id: 'c2' } },
        create: expect.objectContaining({ is_main: true }),
        update: expect.objectContaining({ is_main: true }),
      }),
    )
  })

  it('throws 404 when the new main church is not approved', async () => {
    db.$transaction.mockImplementation(async (fn) => fn(tx))
    tx.church.findFirst.mockResolvedValue(null)
    await expect(
      UPDATE_ME_PROFILE({ userId: 'u1', mainChurchId: 'c-pending' }),
    ).rejects.toMatchObject({ code: 404 })
    expect(tx.userChurch.upsert).not.toHaveBeenCalled()
  })
})
