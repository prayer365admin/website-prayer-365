import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  voiceProfile: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { LIST_CENTRAL_PROFILES } from './voice'

describe('LIST_CENTRAL_PROFILES', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations))
  })

  it('paginates and filters only the latest profile for each pastor', async () => {
    db.voiceProfile.findMany
      .mockResolvedValueOnce([{ id: 'latest-pastor-1' }, { id: 'latest-pastor-2' }])
      .mockResolvedValueOnce([])
    db.voiceProfile.count.mockResolvedValue(2)

    const result = await LIST_CENTRAL_PROFILES({
      query: {
        page: 1,
        limit: 25,
        order_by: 'created_at',
        order_direction: 'desc',
        review_state: 'SUBMITTED',
      },
    })

    expect(db.voiceProfile.findMany).toHaveBeenNthCalledWith(1, {
      distinct: ['pastor_id'],
      orderBy: [{ pastor_id: 'asc' }, { created_at: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    expect(db.voiceProfile.count).toHaveBeenCalledWith({
      where: {
        id: { in: ['latest-pastor-1', 'latest-pastor-2'] },
        review_state: 'SUBMITTED',
      },
    })
    expect(db.voiceProfile.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: { in: ['latest-pastor-1', 'latest-pastor-2'] },
          review_state: 'SUBMITTED',
        },
        take: 25,
        skip: 0,
      }),
    )
    expect(result).toEqual({ result: [], total: 2 })
  })
})
