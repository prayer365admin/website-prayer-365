import { beforeEach, describe, expect, it, vi } from 'vitest'
import { withIdempotency } from './idempotency'

const find = vi.fn()
const create = vi.fn()
const del = vi.fn()
const fakeTx = { idempotencyRecord: { findFirst: find, create, delete: del } }

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(fakeTx)),
}))

vi.mock('@/utils/hash', () => ({
  hashSecret: vi.fn(async ({ secret }: { secret: string }) => `hash:${secret}`),
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
  it('writes no record and rethrows when the business action fails (e.g. rate limit)', async () => {
    find.mockResolvedValue(null)
    const failing = vi.fn(async () => {
      throw Object.assign(new Error('limited'), { code: 429 })
    })
    await expect(call({ run: failing })).rejects.toMatchObject({ code: 429 })
    expect(create).not.toHaveBeenCalled()
  })
})
