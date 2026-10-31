import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENV_FILE,
  DEFAULT_PROFILE,
  SECRET_SPECS,
  classify,
  decodeMaybeBase64,
  mask,
} from '../scripts/seed-secrets-rules'

/*
 * The seeding script's only dangerous decisions live here: what value each secret
 * gets, and whether a stored value may be overwritten. AWS and the terminal are the
 * CLI's job, so these rules can be tested without credentials.
 */

const spec = (name: string) => {
  const found = SECRET_SPECS.find((entry) => entry.name === name)
  if (!found) throw new Error(`no spec named ${name}`)
  return found
}

const build = (name: string, env: Record<string, string>) => spec(name).build(env)

const SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'prayer-365',
  client_email: 'firebase@prayer-365.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----x-----END PRIVATE KEY-----\n',
})

const DEVICE_KEY = Buffer.alloc(32, 7).toString('base64')

describe('database-url', () => {
  it('accepts a postgres URL and rejects anything else', () => {
    expect(build('database-url', { DATABASE_URL: 'postgresql://u:p@host:25060/db' })).toEqual({
      value: 'postgresql://u:p@host:25060/db',
    })
    expect(build('database-url', { DATABASE_URL: 'mysql://u:p@host/db' })).toHaveProperty('error')
    expect(build('database-url', {})).toHaveProperty('error')
  })
})

describe('mail-credentials', () => {
  it('is an empty object for SES, which authenticates as the role', () => {
    expect(build('mail-credentials', { MAIL_PROVIDER: 'ses' })).toEqual({ value: '{}' })
  })

  it('carries the credential pair of the selected SMTP provider', () => {
    expect(
      build('mail-credentials', {
        MAIL_PROVIDER: 'mailgun',
        MAILGUN_USER: 'u',
        MAILGUN_PASSWORD: 'p',
      }),
    ).toEqual({ value: JSON.stringify({ MAILGUN_USER: 'u', MAILGUN_PASSWORD: 'p' }) })

    expect(
      build('mail-credentials', {
        MAIL_PROVIDER: 'mailtrap',
        MAILTRAP_USER: 'u2',
        MAILTRAP_PASSWORD: 'p2',
      }),
    ).toEqual({ value: JSON.stringify({ MAILTRAP_USER: 'u2', MAILTRAP_PASSWORD: 'p2' }) })
  })

  it('refuses an unknown provider and a missing credential pair', () => {
    expect(build('mail-credentials', { MAIL_PROVIDER: 'brevo' })).toHaveProperty('error')
    expect(build('mail-credentials', { MAIL_PROVIDER: 'mailgun' })).toHaveProperty('error')
  })
})

describe('device-token-key', () => {
  it('accepts exactly 32 decoded bytes', () => {
    expect(build('device-token-key', { DEVICE_TOKEN_KEY: DEVICE_KEY })).toEqual({
      value: DEVICE_KEY,
    })
  })

  it('rejects a short key and explains how to generate one', () => {
    const short = Buffer.alloc(16, 1).toString('base64')
    expect(build('device-token-key', { DEVICE_TOKEN_KEY: short })).toHaveProperty('error')

    const missing = build('device-token-key', {})
    expect(missing).toHaveProperty('error')
    expect(JSON.stringify(missing)).toContain('--print-device-key')
  })
})

describe('firebase-service-account', () => {
  it('accepts raw JSON and base64-encoded JSON', () => {
    expect(
      build('firebase-service-account', { FIREBASE_SERVICE_ACCOUNT: SERVICE_ACCOUNT }),
    ).toEqual({ value: SERVICE_ACCOUNT })

    const encoded = Buffer.from(SERVICE_ACCOUNT).toString('base64')
    expect(build('firebase-service-account', { FIREBASE_SERVICE_ACCOUNT: encoded })).toEqual({
      value: SERVICE_ACCOUNT,
    })
  })

  it('rejects a JSON object without the service-account fields', () => {
    expect(
      build('firebase-service-account', { FIREBASE_SERVICE_ACCOUNT: '{"project_id":"x"}' }),
    ).toHaveProperty('error')
    expect(build('firebase-service-account', {})).toHaveProperty('error')
  })

  it('leaves a non-JSON string untouched when decoding', () => {
    expect(decodeMaybeBase64('not-a-json-value')).toBe('not-a-json-value')
  })
})

describe('classify', () => {
  const isJson = (value: string) => value.trimStart().startsWith('{')

  it('treats a missing, empty or equal value correctly', () => {
    expect(classify(null, '{}', isJson)).toBe('new')
    expect(classify('', '{}', isJson)).toBe('new')
    expect(classify('{}', '{}', isJson)).toBe('unchanged')
  })

  it('separates a real change from a CDK placeholder', () => {
    expect(classify('{"MAILGUN_USER":"u"}', '{}', isJson)).toBe('change')
    expect(classify('H,,%n0zH>i^bJ7-1aj4kQ2rX+ho8dPUe1', '{}', isJson)).toBe('placeholder')
  })
})

describe('presentation', () => {
  it('masks the middle of a value and keeps short values useless', () => {
    expect(mask('sk_test_1234567890abcdef')).toBe('sk_t…cdef (24)')
    expect(mask('ses')).toBe('s*** (3)')
    expect(mask(null)).toBe('(none)')
    expect(mask('')).toBe('(empty)')
  })

  it('maps each environment to its local file and credential source', () => {
    expect(DEFAULT_ENV_FILE.catatia).toBe('.env')
    expect(DEFAULT_ENV_FILE['prayer-365']).toBe('.env.prod')
    expect(DEFAULT_PROFILE.catatia).toBeUndefined()
    expect(DEFAULT_PROFILE['prayer-365']).toBe('catatia_dev')
  })
})
