// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { tx } = vi.hoisted(() => ({
  tx: {
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    oAuthAccount: { deleteMany: vi.fn() },
    authToken: { updateMany: vi.fn() },
    deviceToken: { deleteMany: vi.fn() },
    outboxJob: { updateMany: vi.fn() },
    privacyJob: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('@/utils/db-connection', () => ({ db: {} }))
vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: (fn: (t: typeof tx) => unknown) => fn(tx),
}))

import { SOFT_DELETE_USER } from './privacy-delete'

describe('SOFT_DELETE_USER', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tx.user.findUniqueOrThrow.mockResolvedValue({ email: 'maria@example.com', deleted_email: null })
    tx.user.update.mockResolvedValue({ id: 'u1' })
  })

  const run = () => SOFT_DELETE_USER({ userId: 'u1', jobId: 'j1', requestId: 'r1' })

  it('soft-deletes and frees the email: original kept in deleted_email, placeholder in email', async () => {
    await run()
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        status: 'inactive',
        deleted_at: expect.any(Date),
        deleted_email: 'maria@example.com',
        email: 'deleted+u1@invalid',
        auth_version: { increment: 1 },
      }),
      select: { id: true },
    })
  })

  it('keeps the name and the other profile fields: only status/deleted_at/email are written', async () => {
    await run()
    const data = tx.user.update.mock.calls[0][0].data
    expect(Object.keys(data).sort()).toEqual(
      ['auth_version', 'deleted_at', 'deleted_email', 'email', 'status'].sort(),
    )
    expect(data).not.toHaveProperty('name')
    expect(data).not.toHaveProperty('password')
    expect(data).not.toHaveProperty('profile_asset_id')
  })

  it('a repeat run keeps the ORIGINAL address, never the placeholder', async () => {
    tx.user.findUniqueOrThrow.mockResolvedValue({
      email: 'deleted+u1@invalid',
      deleted_email: 'maria@example.com',
    })
    await run()
    expect(tx.user.update.mock.calls[0][0].data.deleted_email).toBe('maria@example.com')
  })

  it('removes the Google link so the same Google account can register again', async () => {
    await run()
    expect(tx.oAuthAccount.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'u1' } })
  })

  it('switches off what can still act: tokens, push devices, queued mail to the ORIGINAL address', async () => {
    await run()
    expect(tx.authToken.updateMany).toHaveBeenCalledTimes(2) // refresh revoked + links spent
    expect(tx.deviceToken.deleteMany).toHaveBeenCalledWith({ where: { user_id: 'u1' } })
    expect(tx.outboxJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'mail.send',
          payload: { path: ['to'], equals: 'maria@example.com' },
        }),
        data: { state: 'FAILED', last_error_code: 'RECIPIENT_DELETED' },
      }),
    )
  })

  it('completes the job and audits it, in the same transaction', async () => {
    await run()
    expect(tx.privacyJob.update).toHaveBeenCalledWith({
      where: { id: 'j1' },
      data: { state: 'COMPLETED', completed_at: expect.any(Date) },
    })
    expect(tx.auditLog.create).toHaveBeenCalledOnce()
  })
})
