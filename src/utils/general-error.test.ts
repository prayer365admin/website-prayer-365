import { describe, expect, it } from 'vitest'
import { GeneralError } from './general-error'

describe('GeneralError', () => {
  it('carries all error fields and is an Error instance', () => {
    const err = new GeneralError({
      code: 401,
      details: 'nope',
      error: 'UNAUTHORIZED',
      error_code: 'TOKEN_EXPIRED',
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe(401)
    expect(err.error_code).toBe('TOKEN_EXPIRED')
    expect(err.error).toBe('UNAUTHORIZED')
    expect(err.details).toBe('nope')
  })
})
