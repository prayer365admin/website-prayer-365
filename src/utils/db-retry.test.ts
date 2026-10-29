import { describe, expect, it, vi } from 'vitest'
import { isConnectionLimitError, withConnectionRetry } from './db-retry'

const refusedConnection = () =>
  Object.assign(new Error('Too many database connections opened'), { code: 'P2037' })

describe('isConnectionLimitError', () => {
  it('recognises only the connection-ceiling signatures', () => {
    expect(isConnectionLimitError(refusedConnection())).toBe(true)
    expect(isConnectionLimitError(new Error('DriverAdapterError: TooManyConnections'))).toBe(true)
    expect(isConnectionLimitError(new Error('relation "donation" does not exist'))).toBe(false)
    expect(isConnectionLimitError(undefined)).toBe(false)
  })
})

describe('withConnectionRetry', () => {
  it('retries once after a refused connection and returns the result', async () => {
    const work = vi.fn().mockRejectedValueOnce(refusedConnection()).mockResolvedValue('ok')

    await expect(withConnectionRetry(work, { delayMs: 0 })).resolves.toBe('ok')
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('never retries a real fault', async () => {
    const work = vi.fn().mockRejectedValue(new Error('database down'))

    await expect(withConnectionRetry(work, { delayMs: 0 })).rejects.toThrow('database down')
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('rethrows when the connection is still refused after the last attempt', async () => {
    const work = vi.fn().mockRejectedValue(refusedConnection())

    await expect(withConnectionRetry(work, { delayMs: 0 })).rejects.toMatchObject({
      code: 'P2037',
    })
    expect(work).toHaveBeenCalledTimes(2)
  })
})
