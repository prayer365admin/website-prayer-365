const RAW_ALLOWLIST = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const EXPLICIT_ORIGINS = RAW_ALLOWLIST.filter((origin) => origin !== '*')
const ALLOW_ALL = RAW_ALLOWLIST.includes('*')

export const CORS_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
export const CORS_HEADERS = 'Content-Type, Authorization, X-Requested-With'

/**
 * CORS response headers for a request origin, or null when CORS must not be
 * enabled (no origin / not allowlisted). Explicit allowlist (credentialed)
 * takes precedence over "*" (public, no credentials).
 */
export function resolveCorsHeaders(origin: string | null): Record<string, string> | null {
  if (!origin) return null // same-origin, curl, native mobile, server-to-server

  if (EXPLICIT_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    }
  }

  if (ALLOW_ALL) {
    return { 'Access-Control-Allow-Origin': '*' } // public: '*' + credentials is spec-forbidden
  }

  return null // browser must block
}
