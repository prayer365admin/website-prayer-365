// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  activeCount: vi.fn(),
  bySequence: vi.fn(),
  enqueue: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/providers/general-prayer', () => ({
  COUNT_ACTIVE_GENERAL_PRAYERS: mocks.activeCount,
  GET_GENERAL_PRAYER_BY_SEQUENCE: mocks.bySequence,
  ENQUEUE_GENERAL_PRAYER_SEND_JOB: mocks.enqueue,
}))
vi.mock('@/utils/logger', () => ({ logger: mocks.logger }))

import { scanDueGeneralPrayer } from './general-prayer-schedule'

/*
 * The sweep runs on every dispatcher tick (~1 440 times a day). It must create
 * exactly one row per calendar date and nothing before the local send hour.
 * Idempotency is the unique dedupe key — the mock returns `count: 0` once the
 * row exists, which is what Postgres does.
 */

/** 06:59 Europe/Tallinn on 2026-11-13 (EET, +2). */
const BEFORE = new Date('2026-11-13T04:59:00.000Z')
/** 07:00 Europe/Tallinn on 2026-11-13. */
const AT_HOUR = new Date('2026-11-13T05:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.activeCount.mockResolvedValue(10)
  mocks.bySequence.mockResolvedValue({
    id: 'gp-2',
    sequence: 2,
    slug: 'paivapalve-2',
    is_active: true,
  })
  mocks.enqueue.mockResolvedValue({ count: 1 })
})

describe('scanDueGeneralPrayer', () => {
  it('creates nothing before the local send hour', async () => {
    await expect(scanDueGeneralPrayer({ now: BEFORE })).resolves.toEqual({ enqueued: 0 })
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('creates exactly one job at the send hour, keyed by the calendar date', async () => {
    await expect(scanDueGeneralPrayer({ now: AT_HOUR })).resolves.toEqual({ enqueued: 1 })
    expect(mocks.enqueue).toHaveBeenCalledTimes(1)
    expect(mocks.enqueue).toHaveBeenCalledWith({
      dateISO: '2026-11-13',
      generalPrayerId: 'gp-2',
      availableAt: new Date('2026-11-13T05:00:00.000Z'),
    })
  })

  it('resolves the cycle position for the date, not a fixed prayer', async () => {
    // 2026-11-13 is one day after the anchor, so position 2 of 10.
    await scanDueGeneralPrayer({ now: AT_HOUR })
    expect(mocks.bySequence).toHaveBeenCalledWith({ sequence: 2 })
  })

  it('creates nothing on later ticks of the same day (dedupe key already taken)', async () => {
    mocks.enqueue.mockResolvedValue({ count: 0 })
    await expect(scanDueGeneralPrayer({ now: AT_HOUR })).resolves.toEqual({ enqueued: 0 })
    await expect(scanDueGeneralPrayer({ now: AT_HOUR })).resolves.toEqual({ enqueued: 0 })
  })

  it('creates a new job on the next calendar date', async () => {
    await scanDueGeneralPrayer({ now: AT_HOUR })
    await scanDueGeneralPrayer({ now: new Date('2026-11-14T05:00:00.000Z') })
    expect(mocks.enqueue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dateISO: '2026-11-14', generalPrayerId: 'gp-2' }),
    )
  })

  it('sends nothing when the cycle is empty', async () => {
    mocks.activeCount.mockResolvedValue(0)
    await expect(scanDueGeneralPrayer({ now: AT_HOUR })).resolves.toEqual({ enqueued: 0 })
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('sends nothing when the resolved position has no row', async () => {
    mocks.bySequence.mockResolvedValue(null)
    await expect(scanDueGeneralPrayer({ now: AT_HOUR })).resolves.toEqual({ enqueued: 0 })
    expect(mocks.enqueue).not.toHaveBeenCalled()
    expect(mocks.logger.warn).toHaveBeenCalled()
  })

  it('catches up after a dispatcher gap later in the day', async () => {
    // 09:30 local: the 07:00 window was missed, the prayer still goes out today.
    await expect(
      scanDueGeneralPrayer({ now: new Date('2026-11-13T07:30:00.000Z') }),
    ).resolves.toEqual({ enqueued: 1 })
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ dateISO: '2026-11-13' }))
  })
})
