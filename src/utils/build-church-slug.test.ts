import { describe, expect, it, vi, beforeEach } from 'vitest'
import { buildChurchSlug } from './build-church-slug'
import { db } from '@/utils/db-connection'

vi.mock('@/utils/db-connection', () => ({
  db: {
    church: {
      findFirst: vi.fn(),
    },
  },
}))

describe('buildChurchSlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns clean slug when available', async () => {
    vi.mocked(db.church.findFirst).mockResolvedValueOnce(null)
    const slug = await buildChurchSlug("St. John's Church")
    expect(slug).toBe('st-johns-church')
    expect(db.church.findFirst).toHaveBeenCalledWith({
      where: { slug: 'st-johns-church' },
      select: { id: true },
    })
  })

  it('retries with suffix when slug is taken', async () => {
    vi.mocked(db.church.findFirst)
      .mockResolvedValueOnce({ id: 'c1' } as never)
      .mockResolvedValueOnce(null)
    const slug = await buildChurchSlug("St. John's Church")
    expect(slug).toMatch(/^st-johns-church-[a-zA-Z0-9]{6}$/)
    expect(db.church.findFirst).toHaveBeenCalledTimes(2)
  })

  // Prod pool is 1 connection: a lookup on `db` from inside a transaction
  // deadlocks until the transaction expires.
  it('queries through the transaction client when one is given', async () => {
    const tx = { church: { findFirst: vi.fn().mockResolvedValue(null) } }
    const slug = await buildChurchSlug("St. John's Church", tx as never)
    expect(slug).toBe('st-johns-church')
    expect(tx.church.findFirst).toHaveBeenCalledTimes(1)
    expect(db.church.findFirst).not.toHaveBeenCalled()
  })
})
