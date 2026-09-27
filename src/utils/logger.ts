import { createLogger, format, Logger, transports } from 'winston'

/*
 * Vercel-safe logger (SPEC decision A9):
 * - Console (stdout) transport ONLY. Vercel captures stdout into its logs;
 *   serverless FS is ephemeral so file/stream transports are forbidden.
 * - Structured JSON lines, always carrying a request_id.
 * - Central redaction: any field whose key matches a denylist (password,
 *   token, provider secret, private request text, contact detail) is replaced
 *   with [REDACTED] before the line is emitted.
 */

const REDACT_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'provider_key',
  'api_key',
  'secret',
  'authorization',
  'message', // private request bodies
  'request_message',
  'phone',
  'email',
  'token_ciphertext',
  'provider_voice_id',
])

/** Pure recursive redactor used by the winston filter; exported for tests. */
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redact(v)
    }
    return out
  }
  return value
}

const redactFilter = format((info) => redact(info) as typeof info)

export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(redactFilter(), format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

/** Child logger bound to a request_id for distributed trace correlation. */
export const requestLogger = (request_id: string) => logger.child({ request_id })
