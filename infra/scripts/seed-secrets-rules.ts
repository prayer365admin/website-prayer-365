/*
 * Pure rules behind `seed-secrets.ts`: which secret gets which value out of a
 * local .env, and how a stored value is classified. No AWS, no console — the CLI
 * file owns both, so this module can be unit-tested.
 *
 * Naming: the spec list is the single source of truth for "what the workers read".
 * Adding a secret to `SECRET_ENV` in infra/lib/worker-stack.ts means adding one
 * entry here, otherwise the deploy leaves it unseeded.
 */

export type BuildResult = { value: string } | { error: string }

export type SecretSpec = {
  /** Secret name suffix, e.g. `database-url` -> /prayer365/<env>/database-url */
  name: string
  /** `.env` keys this secret is built from (used in messages). */
  keys: string[]
  /** Shape the stored value must have to count as "real". */
  isValid: (value: string) => boolean
  /** Build the payload from a parsed .env file. */
  build: (env: Record<string, string>) => BuildResult
}

const present = (env: Record<string, string>, key: string): string | undefined => {
  const value = env[key]
  return value === undefined || value === '' ? undefined : value
}

const single = (key: string, isValid: (value: string) => boolean): SecretSpec => ({
  name: key.toLowerCase().replace(/_/g, '-'),
  keys: [key],
  isValid,
  build: (env) => {
    const value = present(env, key)
    if (!value) return { error: `${key} is missing or empty` }
    if (!isValid(value)) return { error: `${key} does not look right` }
    return { value }
  },
})

/** Providers the mailer supports (src/controller/mail.tsx). */
const MAIL_PROVIDERS = ['ses', 'mailgun', 'mailtrap'] as const

export const SECRET_SPECS: SecretSpec[] = [
  {
    name: 'database-url',
    keys: ['DATABASE_URL'],
    isValid: (value) => /^postgres(ql)?:\/\/\S+/.test(value),
    build: (env) => {
      const value = present(env, 'DATABASE_URL')
      if (!value) return { error: 'DATABASE_URL is missing or empty' }
      if (!/^postgres(ql)?:\/\//.test(value)) return { error: 'DATABASE_URL is not a postgres URL' }
      return { value }
    },
  },
  single('ELEVENLABS_API_KEY', (value) => /^sk_[A-Za-z0-9]{16,}$/.test(value)),
  single('STRIPE_SECRET_KEY', (value) => /^(sk|rk)_[A-Za-z0-9_]{10,}$/.test(value)),
  single('STRIPE_WEBHOOK_SECRET', (value) => /^whsec_[A-Za-z0-9]+$/.test(value)),
  {
    // The worker only needs credentials; the provider is deployment configuration,
    // so a `MAIL_PROVIDER` key inside this secret would be ignored anyway.
    name: 'mail-credentials',
    keys: [
      'MAIL_PROVIDER',
      'MAILGUN_USER',
      'MAILGUN_PASSWORD',
      'MAILTRAP_USER',
      'MAILTRAP_PASSWORD',
    ],
    isValid: isJson,
    build: (env) => {
      const provider = present(env, 'MAIL_PROVIDER') ?? 'mailtrap'
      if (!MAIL_PROVIDERS.includes(provider as (typeof MAIL_PROVIDERS)[number])) {
        return { error: `MAIL_PROVIDER="${provider}" is not one of ${MAIL_PROVIDERS.join(', ')}` }
      }
      if (provider === 'ses') return { value: '{}' }
      const prefix = provider.toUpperCase()
      const user = present(env, `${prefix}_USER`)
      const password = present(env, `${prefix}_PASSWORD`)
      if (!user || !password) {
        return {
          error: `${prefix}_USER and ${prefix}_PASSWORD are needed when MAIL_PROVIDER=${provider}`,
        }
      }
      return {
        value: JSON.stringify({ [`${prefix}_USER`]: user, [`${prefix}_PASSWORD`]: password }),
      }
    },
  },
  {
    // Must be the same value the web app holds: it encrypts the device token on one
    // side and the worker decrypts it on the other.
    name: 'device-token-key',
    keys: ['DEVICE_TOKEN_KEY'],
    isValid: (value) => Buffer.from(value, 'base64').length === 32,
    build: (env) => {
      const value = present(env, 'DEVICE_TOKEN_KEY')
      if (!value) {
        return {
          error:
            'DEVICE_TOKEN_KEY is missing (base64 32 bytes; `--print-device-key` generates one, the web app must hold the same value)',
        }
      }
      if (Buffer.from(value, 'base64').length !== 32) {
        return { error: 'DEVICE_TOKEN_KEY must decode to exactly 32 bytes' }
      }
      return { value }
    },
  },
  {
    name: 'firebase-service-account',
    keys: ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_SERVICE_ACCOUNT_FILE'],
    isValid: isServiceAccount,
    build: (env) => {
      // The CLI resolves FIREBASE_SERVICE_ACCOUNT_FILE into FIREBASE_SERVICE_ACCOUNT
      // before calling this, so the rules stay pure.
      const raw = present(env, 'FIREBASE_SERVICE_ACCOUNT')
      if (!raw) {
        return {
          error:
            'FIREBASE_SERVICE_ACCOUNT (JSON or base64) or FIREBASE_SERVICE_ACCOUNT_FILE is missing',
        }
      }
      const json = decodeMaybeBase64(raw)
      if (!isServiceAccount(json)) {
        return {
          error:
            'FIREBASE_SERVICE_ACCOUNT must be service-account JSON with project_id, client_email, private_key',
        }
      }
      return { value: json }
    },
  },
]

function isJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function isServiceAccount(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Boolean(parsed.project_id && parsed.client_email && parsed.private_key)
  } catch {
    return false
  }
}

/** Service-account JSON may be pasted raw or base64-encoded in .env. */
export const decodeMaybeBase64 = (raw: string): string => {
  if (raw.trimStart().startsWith('{')) return raw
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8')
    return decoded.trimStart().startsWith('{') ? decoded : raw
  } catch {
    return raw
  }
}

export type SecretStatus = 'new' | 'placeholder' | 'change' | 'unchanged'

/**
 * `new`          no container or no value yet
 * `placeholder`  a value exists but cannot be what this secret needs (CDK random string)
 * `change`       a real value differs from the local file
 * `unchanged`    identical — never written
 */
export const classify = (
  current: string | null,
  desired: string,
  isValid: (value: string) => boolean,
): SecretStatus => {
  if (current === null || current === '') return 'new'
  if (current === desired) return 'unchanged'
  return isValid(current) ? 'change' : 'placeholder'
}

/** Show enough to recognise a value, never enough to use it. */
export const mask = (value: string | null): string => {
  if (value === null) return '(none)'
  if (value === '') return '(empty)'
  if (value.length <= 8) return `${value.slice(0, 1)}*** (${value.length})`
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length})`
}

/** Default local file and AWS profile per environment. */
export const DEFAULT_ENV_FILE: Record<string, string> = {
  catatia: '.env',
  'prayer-365': '.env.prod',
}

export const DEFAULT_PROFILE: Record<string, string | undefined> = {
  // catatia: the admin keys live in .env, which deploy.sh sources into the shell.
  catatia: undefined,
  // The client account's runtime user is S3+SES only; secrets need catatia_dev.
  'prayer-365': 'catatia_dev',
}
