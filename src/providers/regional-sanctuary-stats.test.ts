import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  church: { count: vi.fn() },
  orgNode: { count: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { GET_REGIONAL_SANCTUARY_STATS } from './regional-sanctuary-stats'

describe('GET_REGIONAL_SANCTUARY_STATS', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts approved churches and configured dioceses', async () => {
    db.church.count.mockResolvedValue(12)
    db.orgNode.count.mockResolvedValue(3)

    await expect(GET_REGIONAL_SANCTUARY_STATS()).resolves.toEqual({
      approvedChurches: 12,
      dioceses: 3,
    })
    expect(db.church.count).toHaveBeenCalledWith({ where: { status: 'APPROVED' } })
    expect(db.orgNode.count).toHaveBeenCalledWith({ where: { kind: 'DIOCESE' } })
  })
})
