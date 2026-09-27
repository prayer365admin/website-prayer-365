import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/church', () => ({ GET_CHURCH_VERSION: vi.fn() }))
vi.mock('@/providers/service-time', () => ({
  GET_SERVICE_TIMES: vi.fn(),
  REPLACE_SERVICE_TIMES: vi.fn(),
}))

import { GET_CHURCH_VERSION } from '@/providers/church'
import { GET_SERVICE_TIMES, REPLACE_SERVICE_TIMES } from '@/providers/service-time'
import { getServiceTimes, replaceServiceTimes } from './service-time'

const input = {
  version: 3,
  schedule: [{ weekday: 1, localTime: '09:00:00', label: 'Mass', languageCode: 'en' }],
}

beforeEach(() => vi.clearAllMocks())

describe('getServiceTimes', () => {
  it('returns the scoped schedule', async () => {
    vi.mocked(GET_SERVICE_TIMES).mockResolvedValue([
      { id: 's1', weekday: 1, localTime: '09:00:00', label: null, languageCode: null },
    ] as never)
    await expect(getServiceTimes({ churchIds: new Set(['c1']) })).resolves.toHaveLength(1)
  })

  it('throws 404 for an empty scope', async () => {
    await expect(getServiceTimes({ churchIds: new Set() })).rejects.toMatchObject({ code: 404 })
  })
})

describe('replaceServiceTimes', () => {
  it('throws 403 when the church is outside the caller scope', async () => {
    await expect(
      replaceServiceTimes({
        userId: 'u1',
        churchId: 'c9',
        churchIds: new Set(['c1']),
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('throws 409 STALE_VERSION on version mismatch', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(5 as never)
    await expect(
      replaceServiceTimes({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1']),
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(REPLACE_SERVICE_TIMES).not.toHaveBeenCalled()
  })

  it('throws 404 when the church is not found', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(null as never)
    await expect(
      replaceServiceTimes({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1']),
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('transactionally replaces the schedule', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(REPLACE_SERVICE_TIMES).mockResolvedValue({ count: 1 } as never)
    const res = await replaceServiceTimes({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
      input,
      requestId: 'r',
    })
    expect(res.count).toBe(1)
    expect(REPLACE_SERVICE_TIMES).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, schedule: input.schedule }),
    )
  })
})
