import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  church: { findMany: vi.fn() },
  userChurch: { groupBy: vi.fn() },
}))

vi.mock('@/utils/db-connection', () => ({ db }))

import { LIST_CHURCH_OPTIONS, LIST_FREQUENT_CHURCHES } from './church-option'

const church = (id: string, city?: string) => ({
  id,
  name: `Church ${id}`,
  address: city ? { city, street: 'private-ish' } : null,
})

describe('LIST_CHURCH_OPTIONS', () => {
  beforeEach(() => vi.clearAllMocks())

  it('searches APPROVED churches only, capped at 20, minimal select', async () => {
    db.church.findMany.mockResolvedValue([church('a', 'Tallinn')])

    const result = await LIST_CHURCH_OPTIONS({ query: { search: 'jaani' } })

    expect(db.church.findMany).toHaveBeenCalledWith({
      where: { status: 'APPROVED', name: { contains: 'jaani', mode: 'insensitive' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 20,
      select: { id: true, name: true, address: true },
    })
    // Only id/name/city leave the provider — no street or other address fields.
    expect(result).toEqual([{ id: 'a', name: 'Church a', city: 'Tallinn' }])
  })
})

describe('LIST_FREQUENT_CHURCHES', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ranks APPROVED churches by followers (followed or main) and keeps that order', async () => {
    db.userChurch.groupBy.mockResolvedValue([
      { church_id: 'b', _count: { church_id: 9 } },
      { church_id: 'a', _count: { church_id: 5 } },
      { church_id: 'c', _count: { church_id: 3 } },
      { church_id: 'd', _count: { church_id: 1 } },
    ])
    db.church.findMany.mockResolvedValueOnce([church('a'), church('c'), church('d'), church('b')])

    const result = await LIST_FREQUENT_CHURCHES()

    expect(db.userChurch.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['church_id'],
        where: { OR: [{ is_followed: true }, { is_main: true }], church: { status: 'APPROVED' } },
        take: 4,
      }),
    )
    expect(result.map((c) => c.id)).toEqual(['b', 'a', 'c', 'd'])
    expect(db.church.findMany).toHaveBeenCalledTimes(1)
  })

  it('tops up alphabetically when fewer than 4 churches have followers', async () => {
    db.userChurch.groupBy.mockResolvedValue([{ church_id: 'b', _count: { church_id: 2 } }])
    db.church.findMany
      .mockResolvedValueOnce([church('b')])
      .mockResolvedValueOnce([church('x'), church('y'), church('z')])

    const result = await LIST_FREQUENT_CHURCHES()

    expect(db.church.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { status: 'APPROVED', id: { notIn: ['b'] } },
        take: 3,
      }),
    )
    expect(result.map((c) => c.id)).toEqual(['b', 'x', 'y', 'z'])
  })
})
