import { describe, expect, it, vi } from 'vitest'
import { AuditLog } from '@prisma/client'
import { auditPayload, writeAudit } from './audit'

describe('auditPayload', () => {
  it('maps all fields to snake_case columns', () => {
    expect(
      auditPayload({
        actorId: 'u1',
        churchId: 'c1',
        action: 'prayer.publish',
        resourceType: 'prayer',
        resourceId: 'p-1',
        outcome: 'SUCCESS',
        requestId: 'rid-1',
      }),
    ).toEqual({
      actor_id: 'u1',
      church_id: 'c1',
      action: 'prayer.publish',
      resource_type: 'prayer',
      resource_id: 'p-1',
      outcome: 'SUCCESS',
      request_id: 'rid-1',
    })
  })

  it('coerces missing optional refs to null', () => {
    expect(
      auditPayload({ action: 'a', resourceType: 'r', outcome: 'FAIL', requestId: 'rid' }),
    ).toMatchObject({ actor_id: null, church_id: null, resource_id: null })
  })
})

describe('writeAudit', () => {
  it('inserts via tx create, logs summary, and never passes a sensitive body', async () => {
    const create = vi.fn(async (data: unknown) => ({ ...(data as object), id: 'a1' }) as AuditLog)
    const row = await writeAudit(create, {
      actorId: 'u1',
      action: 'church.update',
      resourceType: 'church',
      resourceId: 'c1',
      outcome: 'SUCCESS',
      requestId: 'rid-9',
    })
    expect(row.id).toBe('a1')
    expect(create).toHaveBeenCalledOnce()
    const payload = create.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('message')
    expect(payload).not.toHaveProperty('password')
    expect(payload.request_id).toBe('rid-9')
  })
})
