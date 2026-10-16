import { describe, expect, it } from 'vitest'
import { Writable } from 'node:stream'
import { transports } from 'winston'
import type { TransformableInfo } from 'logform'
import { logger, redact, redactFilter, requestLogger } from './logger'

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

describe('redactFilter (winston integration)', () => {
  it('redacts in place and keeps the winston record shape', () => {
    const info = {
      level: 'info',
      message: 'prayer_publish_tick',
      token: 'abc123',
      summary: { email: 'ann@x.com', published: 2 },
    } as unknown as TransformableInfo & Record<symbol, unknown>
    info[Symbol.for('level')] = 'info'

    const out = redactFilter().transform(info) as typeof info
    const redacted = out as unknown as {
      token: string
      summary: { email: string; published: number }
    }

    // Same object: replacing it makes the transport drop the record entirely.
    expect(out).toBe(info)
    expect(out[Symbol.for('level')]).toBe('info')
    expect(out.message).toBe('prayer_publish_tick')
    expect(redacted.token).toBe('[REDACTED]')
    expect(redacted.summary).toEqual({ email: '[REDACTED]', published: 2 })
  })

  it('keeps error_message visible while still redacting a private `message` field', () => {
    // `message` guards private request bodies; infrastructure failures must use
    // `error_message` or their only clue disappears from the logs.
    const info = {
      level: 'error',
      message: 'audio_generate_job_error',
      error_message: 'AccessDenied: not authorized to perform s3:PutObject',
      detail: { message: 'private prayer body' },
    } as unknown as TransformableInfo

    const out = redactFilter().transform(info) as unknown as {
      error_message: string
      detail: { message: string }
    }

    expect(out.error_message).toBe('AccessDenied: not authorized to perform s3:PutObject')
    expect(out.detail.message).toBe('[REDACTED]')
  })
})

describe('logger output', () => {
  it('emits a JSON line for a real log call and redacts denylisted fields', () => {
    // Capture through a winston transport rather than by spying on
    // process.stdout: the test runner intercepts stdout itself, so a spy sees
    // nothing. This exercises the real logger config (format chain + redaction).
    const lines: string[] = []
    const sink = new Writable({
      write(chunk: Buffer | string, _encoding, callback) {
        lines.push(String(chunk))
        callback()
      },
    })
    const probe = new transports.Stream({ stream: sink })

    logger.add(probe)
    try {
      logger.info('regression_event', { token: 'abc123', prayerId: 'p1' })
    } finally {
      logger.remove(probe)
    }

    // Regression: whole records used to be dropped by the redact filter.
    const line = lines.find((w) => w.includes('regression_event'))
    expect(line).toBeDefined()
    expect(line).toContain('"level":"info"')
    expect(line).toContain('"prayerId":"p1"')
    expect(line).toContain('[REDACTED]')
    expect(line).not.toContain('abc123')
  })
})

describe('requestLogger', () => {
  it('returns a child logger bound to the request id', () => {
    const child = requestLogger('rid-1')
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
  })
})
