/**
 * Connection-pool and retry settings, read from the environment.
 *
 * The two deployments have different database budgets, so none of this is a
 * constant:
 *
 *   prod  (AWS RDS, 79 connections)        DB_POOL_MAX=unlimited
 *   staging (DigitalOcean, 25 connections) DB_POOL_MAX unset -> 1
 *
 * A pool of 1 is only correct behind an external pooler; without one, every
 * second concurrent request on the same serverless instance waits for the
 * single connection and dies as `timeout exceeded when trying to connect`
 * (production evidence, 16 Nov 2026: 20 such errors on www.prayer365.eu).
 *
 *   DB_POOL_MAX                 1 (default) | a positive number | "unlimited"
 *                               ("unlimited" omits `max`, so pg uses its own
 *                               default of 10)
 *   DB_POOL_CONNECT_TIMEOUT_MS  10000
 *   DB_POOL_IDLE_TIMEOUT_MS     10000
 *   DB_RETRY_ATTEMPTS           0 (default) — extra attempts for transient
 *                               connection errors
 */

export const readPositiveNumber = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw?.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export type PoolSettings = {
  /** pg default (10) when omitted, i.e. the `unlimited` setting. */
  max?: number
  connectionTimeoutMillis: number
  idleTimeoutMillis: number
}

type EnvLike = Record<string, string | undefined>

export const readPoolSettings = (env: EnvLike = process.env): PoolSettings => {
  const rawMax = env.DB_POOL_MAX?.trim().toLowerCase()
  const max = !rawMax ? 1 : rawMax === 'unlimited' ? undefined : readPositiveNumber(rawMax, 1)

  return {
    ...(max === undefined ? {} : { max }),
    connectionTimeoutMillis: readPositiveNumber(env.DB_POOL_CONNECT_TIMEOUT_MS, 10_000),
    idleTimeoutMillis: readPositiveNumber(env.DB_POOL_IDLE_TIMEOUT_MS, 10_000),
  }
}

/**
 * Errors that mean "the connection was already dead / never came up", so the
 * query never reached the database and repeating it is safe:
 *   - pg pool: `timeout exceeded when trying to connect` (queue wait)
 *   - pg client: `Connection terminated due to connection timeout`
 *   - pg: `Connection terminated unexpectedly`, ECONNRESET, ETIMEDOUT
 *   - Prisma P2028 `Unable to start a transaction in the given time`
 */
const STALE_CONNECTION_PATTERNS = [
  'timeout exceeded when trying to connect',
  'Connection terminated',
  'connection timeout',
  'ECONNRESET',
  'ETIMEDOUT',
  'Unable to start a transaction',
]

export const isStaleConnectionError = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code
  if (code === 'P2028') return true

  const message = error instanceof Error ? error.message : String(error ?? '')
  return STALE_CONNECTION_PATTERNS.some((pattern) => message.includes(pattern))
}

/**
 * Retry a READ-ONLY database call once the pool has dropped its dead socket.
 * Never wrap a write: a retried write can apply twice.
 *
 * Attempts come from DB_RETRY_ATTEMPTS (0 = no retry, today's behaviour).
 */
export const withDbRetry =
  <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
  async (...args: A): Promise<R> => {
    const attempts = readPositiveNumber(process.env.DB_RETRY_ATTEMPTS, 0) + 1

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await fn(...args)
      } catch (error) {
        if (attempt >= attempts || !isStaleConnectionError(error)) throw error
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt))
      }
    }
  }
