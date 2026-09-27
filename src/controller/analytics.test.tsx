import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/analytics', () => ({
  GET_ANALYTICS: vi.fn(),
  GET_ATTENDANCE_SUMMARY: vi.fn(),
  GET_REGION_SUMMARY: vi.fn(),
}))

import { GET_ANALYTICS, GET_ATTENDANCE_SUMMARY, GET_REGION_SUMMARY } from '@/providers/analytics'
import { getAnalytics, getAttendanceSummary, getRegionSummary } from './analytics'

const churchIds = new Set(['c1'])
const from = new Date('2026-09-01T00:00:00Z')
const to = new Date('2026-09-30T00:00:00Z')

beforeEach(() => vi.resetAllMocks())

describe('getAnalytics', () => {
  it('delegates a church-scoped bounded analytics read', async () => {
    vi.mocked(GET_ANALYTICS).mockResolvedValue({ from, to, checkInCount: 1 } as never)
    const res = await getAnalytics({ churchId: 'c1', churchIds, from, to })
    expect(res.checkInCount).toBe(1)
    expect(GET_ANALYTICS).toHaveBeenCalledWith(expect.objectContaining({ churchIds, from, to }))
  })

  it('hides a cross-church target with 404', async () => {
    await expect(getAnalytics({ churchId: 'other', churchIds, from, to })).rejects.toMatchObject({
      code: 404,
    })
  })
})

describe('getAttendanceSummary', () => {
  it('delegates the aggregate attendance read (no named records)', async () => {
    vi.mocked(GET_ATTENDANCE_SUMMARY).mockResolvedValue({
      from,
      to,
      days: [{ date: '2026-09-01', count: 3 }],
    } as never)
    const res = await getAttendanceSummary({ churchId: 'c1', churchIds, from, to })
    expect(res.days[0]).toEqual({ date: '2026-09-01', count: 3 })
    expect(GET_ATTENDANCE_SUMMARY).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds, from, to }),
    )
  })

  it('hides a cross-church target with 404', async () => {
    await expect(
      getAttendanceSummary({ churchId: 'other', churchIds, from, to }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('getRegionSummary', () => {
  it('delegates the region summary over the descendant church set', async () => {
    vi.mocked(GET_REGION_SUMMARY).mockResolvedValue({ regionId: 'r1', churchCount: 2 } as never)
    const res = await getRegionSummary({
      regionId: 'r1',
      churchIds: new Set(['c1', 'c2']),
      from,
      to,
    })
    expect(res.churchCount).toBe(2)
    expect(GET_REGION_SUMMARY).toHaveBeenCalledWith({
      regionId: 'r1',
      churchIds: new Set(['c1', 'c2']),
      from,
      to,
    })
  })
})
