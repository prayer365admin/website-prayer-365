import { createLogger, format, Logger, transports } from 'winston'
import type { TransformableInfo } from 'logform'

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

/** A JSON-ish node of a log line's metadata after redaction. */
type RedactedNode =
  | string
  | number
  | boolean
  | null
  | RedactedNode[]
  | { [key: string]: RedactedNode }

const redactNode = (value: unknown): RedactedNode => {
  if (Array.isArray(value)) return value.map(redactNode)
  if (value && typeof value === 'object') {
    const out: Record<string, RedactedNode> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactNode(v)
    }
    return out
  }
  return value as RedactedNode
}

/**
 * Pure recursive redactor used by the winston filter; exported for tests.
 * Callers feed it a winston info object, so the boundary returns the
 * logform domain type (tests also exercise arrays/primitives).
 */
export const redact = (value: unknown): TransformableInfo => redactNode(value) as TransformableInfo

const redactFilter = format((info) => redact(info))

export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(redactFilter(), format.timestamp(), format.json()),
  transports: [new transports.Console()],
})

/** Child logger bound to a request_id for distributed trace correlation. */
export const requestLogger = (request_id: string) => logger.child({ request_id })
