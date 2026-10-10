import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withIdempotency, withExternalIdempotency } from './idempotency'

const find = vi.fn()
const create = vi.fn()
const del = vi.fn()
const update = vi.fn()
const deleteMany = vi.fn()
const fakeTx = { idempotencyRecord: { findFirst: find, create, delete: del } }

vi.mock('@/utils/db-connection', () => ({
  db: {
    idempotencyRecord: {
      update: (...args: unknown[]) => update(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}))

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakeTx)),
}))

vi.mock('@/utils/hash', () => ({
  hashContent: vi.fn((content: string) => `hash:${content}`),
}))

const run = vi.fn(async () => 'res-1')

const call = (overrides: Partial<Parameters<typeof withIdempotency>[0]> = {}) =>
  withIdempotency({
    actorKey: 'user-1',
    operation: 'voice.submit',
    key: 'key-1',
    requestBody: { sampleAssetId: 's1' },
    run,
    ...overrides,
  })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('withIdempotency', () => {
  it('requires an idempotency key', async () => {
    await expect(call({ key: '' })).rejects.toMatchObject({
      code: 400,
      error_code: 'IDEMPOTENCY_KEY_REQUIRED',
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('executes business and records on first run', async () => {
    find.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'ide-1' })
    const result = await call()
    expect(result).toEqual({ fresh: true, resource_id: 'res-1' })
    expect(run).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledOnce()
    const data = create.mock.calls[0][0].data
    expect(data.actor_key).toBe('user-1')
    expect(data.key).toBe('key-1')
    expect(data.resource_id).toBe('res-1')
  })

  it('returns stored result on replay with same key+hash, without rerunning', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"sampleAssetId":"s1"}',
      resource_id: 'res-1',
      expires_at: new Date(Date.now() + 60000),
    })
    const result = await call()
    expect(result).toEqual({ fresh: false, resource_id: 'res-1' })
    expect(run).not.toHaveBeenCalled()
  })

  it('conflicts 409 when same key used with a different request hash', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"different":"body"}',
      resource_id: 'res-1',
      expires_at: new Date(Date.now() + 60000),
    })
    await expect(call()).rejects.toMatchObject({ code: 409, error_code: 'IDEMPOTENCY_CONFLICT' })
    expect(run).not.toHaveBeenCalled()
  })

  it('treats an expired key as available for a new request', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"different":"body"}',
      resource_id: 'res-1',
      expires_at: new Date(Date.now() - 1000),
    })
    create.mockResolvedValue({ id: 'ide-2' })
    const result = await call()
    expect(result.fresh).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe('withExternalIdempotency', () => {
  const externalRun = vi.fn(async () => 'ext-res-1')
  const callExt = (overrides: Partial<Parameters<typeof withExternalIdempotency>[0]> = {}) =>
    withExternalIdempotency({
      actorKey: 'user-1',
      operation: 'donation.initiate',
      key: 'key-1',
      requestBody: { amountMinor: 1000 },
      run: externalRun,
      ...overrides,
    })

  it('requires an idempotency key', async () => {
    await expect(callExt({ key: '' })).rejects.toMatchObject({
      code: 400,
      error_code: 'IDEMPOTENCY_KEY_REQUIRED',
    })
    expect(externalRun).not.toHaveBeenCalled()
  })

  it('reserves PENDING, executes external action outside tx, and updates to COMPLETED', async () => {
    find.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'ide-pending-1' })
    update.mockResolvedValue({ id: 'ide-pending-1' })

    const result = await callExt()
    expect(result).toEqual({ fresh: true, resource_id: 'ext-res-1' })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor_key: 'user-1',
          key: 'key-1',
          state: 'PENDING',
        }),
      }),
    )
    expect(externalRun).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ide-pending-1' },
        data: expect.objectContaining({
          resource_id: 'ext-res-1',
          state: 'COMPLETED',
        }),
      }),
    )
  })

  it('replays COMPLETED record without executing external action', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"amountMinor":1000}',
      resource_id: 'cached-session-1',
      state: 'COMPLETED',
      expires_at: new Date(Date.now() + 60000),
    })

    const result = await callExt()
    expect(result).toEqual({ fresh: false, resource_id: 'cached-session-1' })
    expect(externalRun).not.toHaveBeenCalled()
  })

  it('conflicts 409 IDEMPOTENCY_CONFLICT when hash differs', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"different":123}',
      resource_id: 'cached-session-1',
      state: 'COMPLETED',
      expires_at: new Date(Date.now() + 60000),
    })

    await expect(callExt()).rejects.toMatchObject({
      code: 409,
      error_code: 'IDEMPOTENCY_CONFLICT',
    })
    expect(externalRun).not.toHaveBeenCalled()
  })

  it('conflicts 409 IDEMPOTENCY_IN_FLIGHT when state is PENDING', async () => {
    find.mockResolvedValue({
      request_hash: 'hash:{"amountMinor":1000}',
      state: 'PENDING',
      expires_at: new Date(Date.now() + 60000),
    })

    await expect(callExt()).rejects.toMatchObject({
      code: 409,
      error_code: 'IDEMPOTENCY_IN_FLIGHT',
    })
    expect(externalRun).not.toHaveBeenCalled()
  })

  it('cleans up PENDING record if external action throws', async () => {
    find.mockResolvedValue(null)
    create.mockResolvedValue({ id: 'ide-pending-fail' })
    deleteMany.mockResolvedValue({ count: 1 })
    const failingRun = vi.fn(async () => {
      throw new Error('Stripe API timeout')
    })

    await expect(callExt({ run: failingRun })).rejects.toThrow('Stripe API timeout')
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: 'ide-pending-fail', state: 'PENDING' },
    })
  })
})
