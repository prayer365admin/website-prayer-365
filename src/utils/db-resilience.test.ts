import { describe, expect, it, vi } from 'vitest'
import { isStaleConnectionError, readPoolSettings, withDbRetry } from '@/utils/db-resilience'

describe('readPoolSettings', () => {
  it('keeps one connection per instance when DB_POOL_MAX is unset (staging)', () => {
    expect(readPoolSettings({})).toEqual({
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    })
  })

  it('omits max when DB_POOL_MAX=unlimited, so pg uses its own default (prod)', () => {
    expect(readPoolSettings({ DB_POOL_MAX: 'unlimited' })).toEqual({
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
    })
  })

  it('accepts a numeric max and the timeout overrides', () => {
    expect(
      readPoolSettings({
        DB_POOL_MAX: '4',
        DB_POOL_CONNECT_TIMEOUT_MS: '5000',
        DB_POOL_IDLE_TIMEOUT_MS: '30000',
      }),
    ).toEqual({
      max: 4,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    })
  })

  it('falls back to 1 on a garbage value', () => {
    expect(readPoolSettings({ DB_POOL_MAX: 'many' }).max).toBe(1)
  })
})

describe('isStaleConnectionError', () => {
  it.each([
    'timeout exceeded when trying to connect',
    'Connection terminated due to connection timeout',
    'Connection terminated unexpectedly',
    'read ECONNRESET',
  ])('treats %s as a dead connection', (message) => {
    expect(isStaleConnectionError(new Error(message))).toBe(true)
  })

  it('treats Prisma P2028 (transaction could not start) as a dead connection', () => {
    expect(isStaleConnectionError({ code: 'P2028', message: 'Transaction API error' })).toBe(true)
  })

  it('does not retry a real query error', () => {
    expect(
      isStaleConnectionError(new Error('Unique constraint failed on the fields: (`slug`)')),
    ).toBe(false)
  })
})

describe('withDbRetry', () => {
  it('is a passthrough when DB_RETRY_ATTEMPTS is unset', async () => {
    vi.stubEnv('DB_RETRY_ATTEMPTS', '')
    const fn = vi.fn().mockRejectedValue(new Error('timeout exceeded when trying to connect'))
    await expect(withDbRetry(fn)()).rejects.toThrow('timeout exceeded')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.unstubAllEnvs()
  })

  it('retries a dead connection, then returns the successful read', async () => {
    vi.stubEnv('DB_RETRY_ATTEMPTS', '1')
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connection terminated unexpectedly'))
      .mockResolvedValueOnce('row')
    await expect(withDbRetry(fn)('arg')).resolves.toBe('row')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('arg')
    vi.unstubAllEnvs()
  })

  it('never retries a non-connection error', async () => {
    vi.stubEnv('DB_RETRY_ATTEMPTS', '3')
    const fn = vi.fn().mockRejectedValue(new Error('Unique constraint failed'))
    await expect(withDbRetry(fn)()).rejects.toThrow('Unique constraint failed')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.unstubAllEnvs()
  })
})
