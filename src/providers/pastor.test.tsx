// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({}))
vi.mock('@/utils/db-connection', () => ({ db }))

import { UPDATE_PASTOR } from './pastor'

const tx = {
  pastor: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
}

describe('Pastor Provider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a stale central profile update', async () => {
    tx.pastor.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      UPDATE_PASTOR(
        { pastorId: 'p1', expectedVersion: 2, payload: { name: 'Updated' } },
        tx as never,
      ),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(tx.pastor.findUnique).not.toHaveBeenCalled()
  })

  it('atomically increments and returns the central profile version', async () => {
    tx.pastor.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.pastor.findUnique.mockResolvedValueOnce({
      id: 'p1',
      version: 3,
      user_id: null,
      name: 'Updated',
      introduction: null,
      user: null,
      churchPastors: [],
    })

    const result = await UPDATE_PASTOR(
      { pastorId: 'p1', expectedVersion: 2, payload: { name: 'Updated' } },
      tx as never,
    )

    expect(tx.pastor.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', deleted_at: null, version: 2 },
      data: { name: 'Updated', version: { increment: 1 } },
    })
    expect(result.version).toBe(3)
  })
})
