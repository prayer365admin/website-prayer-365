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
import { GET_REQUESTS, GET_REQUEST } from './request'

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
  it('count uses the SAME private filter as rows for a standard reader', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    await GET_REQUESTS({ churchIds: new Set(['c1']), canReadPrivate: false, query })
    const where = countWhere()
    const or = where.OR as Array<Record<string, unknown>>
    expect(or).toBeDefined()
    expect(or[0]).toEqual({ classification: null })
    expect((or[1].classification as { not: string }).not).toBe('PRIVATE')
  })

  it('omits the private filter for a church-local private reader', async () => {
    vi.mocked(db.request.count).mockResolvedValue(2)
    vi.mocked(db.request.findMany).mockResolvedValue([row, { ...row, id: 'r2' }] as never)
    await GET_REQUESTS({ churchIds: new Set(['c1']), canReadPrivate: true, query })
    expect(countWhere().OR).toBeUndefined()
  })

  it('applies the kind allowlist filter to count and rows', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    await GET_REQUESTS({
      churchIds: new Set(['c1']),
      canReadPrivate: false,
      kind: 'pastoral',
      query,
    })
    expect(countWhere().kind).toBe('PASTORAL')
  })

  it('maps rows to camelCase lowercase summaries', async () => {
    vi.mocked(db.request.count).mockResolvedValue(1)
    vi.mocked(db.request.findMany).mockResolvedValue([row] as never)
    const res = await GET_REQUESTS({ churchIds: new Set(['c1']), canReadPrivate: true, query })
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

  it('returns empty for an empty scope', async () => {
    await expect(
      GET_REQUESTS({ churchIds: new Set(), canReadPrivate: false, query }),
    ).resolves.toEqual({ result: [], total: 0 })
  })
})

describe('GET_REQUEST', () => {
  it('returns a private row for a private reader and audits WITHOUT sensitive fields', async () => {
    vi.mocked(db.request.findFirst).mockResolvedValue(row as never)
    const res = await GET_REQUEST({
      churchIds: new Set(['c1']),
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
        churchIds: new Set(['c1']),
        requestId: 'r1',
        canReadPrivate: false,
        actorId: 'u1',
        traceId: 't1',
      }),
    ).resolves.toBeNull()
    expect(writeAudit).not.toHaveBeenCalled()
  })

  it('returns null for an empty scope', async () => {
    await expect(
      GET_REQUEST({
        churchIds: new Set(),
        requestId: 'r1',
        canReadPrivate: true,
        actorId: 'u1',
        traceId: 't1',
      }),
    ).resolves.toBeNull()
  })
})
