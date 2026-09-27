import { describe, expect, it } from 'vitest'
import { redact, requestLogger } from './logger'

describe('redact', () => {
  it('leaves safe fields, redacts secret values', () => {
    const out = redact({ user: { name: 'Ann' }, password: 'hunter2', token: 'abc123' })
    expect(out).toEqual({ user: { name: 'Ann' }, password: '[REDACTED]', token: '[REDACTED]' })
  })

  it('redacts nested private fields regardless of depth', () => {
    const out = redact({ request: { message: 'private prayer', email: 'ann@x.com' }, ok: true })
    expect(out).toEqual({
      request: { message: '[REDACTED]', email: '[REDACTED]' },
      ok: true,
    })
  })

  it('redacts arrays element-wise and is key-case-insensitive', () => {
    const out = redact([{ Password: 'x' }, { token_ciphertext: 'y' }])
    expect(out).toEqual([{ Password: '[REDACTED]' }, { token_ciphertext: '[REDACTED]' }])
  })

  it('returns primitives untouched', () => {
    expect(redact('plain')).toBe('plain')
    expect(redact(7)).toBe(7)
    expect(redact(null)).toBe(null)
  })

  it('never emits the actual secret or private body in output', () => {
    const out = JSON.stringify(redact({ message: 'secret-body', password: 'hunter2' }))
    expect(out).not.toContain('secret-body')
    expect(out).not.toContain('hunter2')
    expect(out).toContain('REDACTED')
  })
})

describe('requestLogger', () => {
  it('returns a child logger bound to the request id', () => {
    const child = requestLogger('rid-1')
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
  })
})
