import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  withIdempotency: vi.fn(),
  tx: { auditLog: { create: vi.fn() } },
}))

vi.mock('@/utils/idempotency', () => ({ withIdempotency: h.withIdempotency }))
vi.mock('@/providers/privacy-job', () => ({
  CREATE_DELETION_JOB: vi.fn(),
  DISABLE_ALL_DEVICES: vi.fn(),
  ENQUEUE_DELETION_FINALIZE: vi.fn(),
  GET_DELETION_ELIGIBILITY: vi.fn(),
  GET_DELETION_JOB_FOR_USER: vi.fn(),
  GET_NEWEST_LOGIN_AT: vi.fn(),
  GET_OPEN_DELETION_JOB: vi.fn(),
  MARK_USER_DELETION_PENDING: vi.fn(),
}))

import * as p from '@/providers/privacy-job'
import { requestMyDeletion } from './mobile-deletion'

const customer = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  status: 'active',
  role: null,
  _count: { roleAssignments: 0, pastors: 0 },
  ...over,
})
const grace = new Date('2026-12-03T00:00:00.000Z')
const call = (key: string | undefined = 'k1') =>
  requestMyDeletion({ userId: 'u1', idempotencyKey: key, requestId: 'r1' })
const errorCode = async (promise: Promise<unknown>) => {
  try {
    await promise
  } catch (e) {
    return (e as { error_code?: string }).error_code
  }
  return undefined
}

describe('requestMyDeletion (DELETE /mobile/me)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(p.GET_DELETION_ELIGIBILITY).mockResolvedValue(customer() as never)
    vi.mocked(p.GET_NEWEST_LOGIN_AT).mockResolvedValue(new Date())
    vi.mocked(p.GET_OPEN_DELETION_JOB).mockResolvedValue(null)
    vi.mocked(p.CREATE_DELETION_JOB).mockResolvedValue({ id: 'j1' } as never)
    vi.mocked(p.GET_DELETION_JOB_FOR_USER).mockResolvedValue({
      id: 'j1',
      state: 'ACCEPTED',
      grace_ends_at: grace,
    } as never)
    h.withIdempotency.mockImplementation(async ({ run }) => ({
      fresh: true,
      resource_id: await run(h.tx),
    }))
  })

  it('accepts: job + hide + devices + finalize schedule + audit, returns the ack', async () => {
    await expect(call()).resolves.toEqual({
      job_id: 'j1',
      state: 'ACCEPTED',
      grace_ends_at: grace.toISOString(),
    })
    expect(p.CREATE_DELETION_JOB).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tx: h.tx }),
    )
    expect(p.MARK_USER_DELETION_PENDING).toHaveBeenCalledWith({ userId: 'u1', tx: h.tx })
    expect(p.DISABLE_ALL_DEVICES).toHaveBeenCalledWith({ userId: 'u1', tx: h.tx })
    expect(p.ENQUEUE_DELETION_FINALIZE).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'j1', tx: h.tx }),
    )
    expect(h.tx.auditLog.create).toHaveBeenCalledOnce()
  })

  it('schedules finalize 14 days out by default', async () => {
    await call()
    const { graceEndsAt } = vi.mocked(p.CREATE_DELETION_JOB).mock.calls[0][0]
    const days = (graceEndsAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(13.99)
    expect(days).toBeLessThanOrEqual(14)
  })

  describe('grace window length (ACCOUNT_DELETION_GRACE_SECONDS)', () => {
    const graceMs = async () => {
      await call()
      const { graceEndsAt } = vi.mocked(p.CREATE_DELETION_JOB).mock.calls[0][0]
      return graceEndsAt.getTime() - Date.now()
    }
    afterEach(() => vi.unstubAllEnvs())

    it('honours a short window outside production (local testing)', async () => {
      vi.stubEnv('ACCOUNT_DELETION_GRACE_SECONDS', '60')
      vi.stubEnv('APP_ENV', 'LOCAL')
      const ms = await graceMs()
      expect(ms).toBeGreaterThan(59_000)
      expect(ms).toBeLessThanOrEqual(60_000)
    })

    it('in production a window under one day is ignored (falls back to 14 days)', async () => {
      vi.stubEnv('ACCOUNT_DELETION_GRACE_SECONDS', '60')
      vi.stubEnv('APP_ENV', 'PROD')
      expect(await graceMs()).toBeGreaterThan(13.99 * 86_400_000)
    })

    it('in production a window of one day or more is honoured', async () => {
      vi.stubEnv('ACCOUNT_DELETION_GRACE_SECONDS', String(7 * 86_400))
      vi.stubEnv('APP_ENV', 'PROD')
      const ms = await graceMs()
      expect(ms).toBeGreaterThan(6.99 * 86_400_000)
      expect(ms).toBeLessThanOrEqual(7 * 86_400_000)
    })
  })

  describe('reason for leaving (plain text, optional)', () => {
    const reasonSaved = () => vi.mocked(p.CREATE_DELETION_JOB).mock.calls[0][0].reason

    it('stores the text it is given, trimmed', async () => {
      await requestMyDeletion({
        userId: 'u1',
        idempotencyKey: 'k1',
        requestId: 'r1',
        reason: '  Privacy concerns ',
      })
      expect(reasonSaved()).toBe('Privacy concerns')
    })

    it.each([[undefined], [''], ['   ']])('no reason (%j) stores null', async (reason) => {
      await requestMyDeletion({ userId: 'u1', idempotencyKey: 'k1', requestId: 'r1', reason })
      expect(reasonSaved()).toBeNull()
    })

    it('a different reason on a replay does not change the idempotency hash (first one wins)', async () => {
      await requestMyDeletion({ userId: 'u1', idempotencyKey: 'k1', requestId: 'r1', reason: 'a' })
      expect(h.withIdempotency).toHaveBeenCalledWith(expect.objectContaining({ requestBody: {} }))
    })
  })

  it('namespaces idempotency per user + operation', async () => {
    await call('abc')
    expect(h.withIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ actorKey: 'user:u1', operation: 'account.delete', key: 'abc' }),
    )
  })

  it('an open job is returned, not duplicated', async () => {
    vi.mocked(p.GET_OPEN_DELETION_JOB).mockResolvedValue({ id: 'j0' } as never)
    vi.mocked(p.GET_DELETION_JOB_FOR_USER).mockResolvedValue({
      id: 'j0',
      state: 'ACCEPTED',
      grace_ends_at: grace,
    } as never)
    await expect(call()).resolves.toMatchObject({ job_id: 'j0' })
    expect(p.CREATE_DELETION_JOB).not.toHaveBeenCalled()
    expect(p.MARK_USER_DELETION_PENDING).not.toHaveBeenCalled()
  })

  it('replay (key already used) does no writes and returns the stored job', async () => {
    h.withIdempotency.mockResolvedValue({ fresh: false, resource_id: 'j1' })
    await expect(call()).resolves.toMatchObject({ job_id: 'j1' })
    expect(p.CREATE_DELETION_JOB).not.toHaveBeenCalled()
  })

  it.each([
    ['staff role', customer({ role: { name: 'super_admin' } })],
    ['role assignment', customer({ _count: { roleAssignments: 1, pastors: 0 } })],
    ['linked pastor', customer({ _count: { roleAssignments: 0, pastors: 1 } })],
  ])('403 DELETION_NOT_ALLOWED for %s', async (_n, user) => {
    vi.mocked(p.GET_DELETION_ELIGIBILITY).mockResolvedValue(user as never)
    expect(await errorCode(call())).toBe('DELETION_NOT_ALLOWED')
    expect(h.withIdempotency).not.toHaveBeenCalled()
  })

  it('allows the prayer_user customer role', async () => {
    vi.mocked(p.GET_DELETION_ELIGIBILITY).mockResolvedValue(
      customer({ role: { name: 'prayer_user' } }) as never,
    )
    await expect(call()).resolves.toMatchObject({ job_id: 'j1' })
  })

  it('401 REAUTH_REQUIRED when the last login is older than 5 minutes', async () => {
    vi.mocked(p.GET_NEWEST_LOGIN_AT).mockResolvedValue(new Date(Date.now() - 6 * 60 * 1000))
    expect(await errorCode(call())).toBe('REAUTH_REQUIRED')
    expect(h.withIdempotency).not.toHaveBeenCalled()
  })

  it('401 REAUTH_REQUIRED when there is no live login at all', async () => {
    vi.mocked(p.GET_NEWEST_LOGIN_AT).mockResolvedValue(null)
    expect(await errorCode(call())).toBe('REAUTH_REQUIRED')
  })

  it('401 when the user is missing or not active', async () => {
    vi.mocked(p.GET_DELETION_ELIGIBILITY).mockResolvedValue(
      customer({ status: 'inactive' }) as never,
    )
    expect(await errorCode(call())).toBe('REAUTH_REQUIRED')
  })
})
