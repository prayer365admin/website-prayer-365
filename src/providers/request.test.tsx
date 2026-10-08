import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParsedListQuery } from '@/utils/pagination'

vi.mock('@/utils/audit', () => ({ writeAudit: vi.fn() }))
vi.mock('@/utils/db-connection', () => ({
  db: {
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    request: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

import { db } from '@/utils/db-connection'
import { writeAudit } from '@/utils/audit'
import { GET_REQUESTS, GET_REQUEST, requestVisibilityWhere } from './request'

const query: ParsedListQuery = {
  page: 1,
  limit: 25,
  order_by: 'created_at',
  order_direction: 'desc',
}
const row = {
  id: 'r1',
  church_id: 'c1',
  kind: 'PRAYER',
  subject: 'S',
  message: 'M',
  classification: 'PRIVATE',
  contact_method: 'phone',
  phone: '123',
  email: 'e@x.com',
  availability: 'mon',
  created_at: new Date('2026-01-01T00:00:00Z'),
}

type CountArg = { where: Record<string, unknown> }
const countWhere = () => (vi.mocked(db.request.count).mock.calls[0][0] as unknown as CountArg).where

beforeEach(() => vi.clearAllMocks())

describe('GET_REQUESTS', () => {
  it('count uses the SAME visibility filter as rows for a standard reader', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    await GET_REQUESTS({ churchId: 'c1', canReadPrivate: false, query })
    const where = countWhere()
    const findWhere = (vi.mocked(db.request.findMany).mock.calls[0][0] as unknown as CountArg).where
    expect(findWhere).toEqual(where)
    expect(where.church_id).toBe('c1')
    // Standard readers see only non-PRIVATE prayer rows (pastoral/meeting restricted, R2).
    expect((where.AND as unknown[])[1]).toEqual(requestVisibilityWhere(false))
  })

  it('targets the exact route church, never a broader scope set', async () => {
    vi.mocked(db.request.count).mockResolvedValue(0)
    vi.mocked(db.request.findMany).mockResolvedValue([] as never)
    await GET_REQUESTS({ churchId: 'c1', canReadPrivate: true, query })
    expect(countWhere().church_id).toBe('c1')
  })

  it('omits the visibility filter for a church-local private reader', async () => {
    vi.mocked(db.request.count).mockResolvedValue(2)
    vi.mocked(db.request.findMany).mockResolvedValue([row, { ...row, id: 'r2' }] as never)
    await GET_REQUESTS({ churchId: 'c1', canReadPrivate: true, query })
    expect(countWhere().AND).toEqual([{}, {}])
  })

  it('applies a multi-kind filter without dropping the visibility rule', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    await GET_REQUESTS({
      churchId: 'c1',
      canReadPrivate: false,
      kinds: ['pastoral', 'meeting'],
      query,
    })
    const and = countWhere().AND as Array<Record<string, unknown>>
    expect(and[0]).toEqual({ kind: { in: ['PASTORAL', 'MEETING'] } })
    expect(and[1]).toEqual(requestVisibilityWhere(false))
  })

  it('maps rows to camelCase lowercase summaries', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    const res = await GET_REQUESTS({ churchId: 'c1', canReadPrivate: true, query })
    expect(res.total).toBe(1)
    expect(res.result[0]).toEqual({
      id: 'r1',
      kind: 'prayer',
      subject: 'S',
      classification: 'private',
      contactMethod: 'phone',
      createdAt: row.created_at.toISOString(),
    })
  })
})

describe('requestVisibilityWhere', () => {
  it('limits standard readers to non-PRIVATE prayer rows', () => {
    expect(requestVisibilityWhere(false)).toEqual({
      kind: 'PRAYER',
      OR: [{ classification: null }, { classification: { not: 'PRIVATE' } }],
    })
  })

  it('is empty for a private reader', () => {
    expect(requestVisibilityWhere(true)).toEqual({})
  })
})

describe('GET_REQUEST', () => {
  it('returns a private row for a private reader and audits WITHOUT sensitive fields', async () => {
    vi.mocked(db.request.findFirst).mockResolvedValue(row as never)
    const res = await GET_REQUEST({
      churchId: 'c1',
      requestId: 'r1',
      canReadPrivate: true,
      actorId: 'u1',
      traceId: 't1',
    })
    expect(res).toMatchObject({ id: 'r1', classification: 'private', contactMethod: 'phone' })
    const auditInput = vi.mocked(writeAudit).mock.calls[0][1] as unknown as Record<string, unknown>
    expect(auditInput).toMatchObject({
      action: 'request.read',
      resourceType: 'request',
      resourceId: 'r1',
      actorId: 'u1',
      churchId: 'c1',
      outcome: 'success',
      requestId: 't1',
    })
    for (const k of [
      'message',
      'phone',
      'email',
      'classification',
      'availability',
      'contactMethod',
    ]) {
      expect(auditInput).not.toHaveProperty(k)
    }
  })

  it('returns null when the row is private to a standard reader (existence hidden)', async () => {
    vi.mocked(db.request.findFirst).mockResolvedValue(null)
    await expect(
      GET_REQUEST({
        churchId: 'c1',
        requestId: 'r1',
        canReadPrivate: false,
        actorId: 'u1',
        traceId: 't1',
      }),
    ).resolves.toBeNull()
    expect(writeAudit).not.toHaveBeenCalled()
  })

  it('looks up by id within the exact church and the visibility rule', async () => {
    vi.mocked(db.request.findFirst).mockResolvedValue(null)
    await GET_REQUEST({
      churchId: 'c1',
      requestId: 'r-pastoral',
      canReadPrivate: false,
      actorId: 'u1',
      traceId: 't1',
    })
    const where = (vi.mocked(db.request.findFirst).mock.calls[0][0] as unknown as CountArg).where
    expect(where).toMatchObject({ id: 'r-pastoral', church_id: 'c1' })
    expect((where.AND as unknown[])[1]).toEqual(requestVisibilityWhere(false))
  })
})
