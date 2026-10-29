import dotenv from 'dotenv'

/*
 * Pure rules behind `sync-env.ts`. Kept separate from the CLI so the diff can be
 * tested without a Vercel session — same split as `seed-verify.ts` / `seed-verify-rules.ts`.
 */

export const VERCEL_ENVIRONMENTS = ['production', 'preview', 'development'] as const
export type VercelEnvironment = (typeof VERCEL_ENVIRONMENTS)[number]

/**
 * `vercel env pull` renders a secret-typed variable as this literal placeholder
 * instead of its value. Writing with `env add` and no `--type` produces exactly
 * that kind of variable, so a naive read-back always looks "different".
 */
export const SENSITIVE_PLACEHOLDER = '[SENSITIVE]'

/** Parse a dotenv file into a plain key/value map (quotes and comments handled by dotenv). */
export const parseEnvText = (text: string): Record<string, string> => dotenv.parse(text)

/**
 * Guess the Vercel environment a local file belongs to. `.env` is the developer's
 * local file, which in this repo mirrors preview; production lives in `.env.prod`.
 */
export const guessTargetEnvironment = (fileName: string): VercelEnvironment => {
  const name = fileName.toLowerCase()
  if (name.includes('prod')) return 'production'
  if (name.includes('dev')) return 'development'
  return 'preview'
}

/** Show enough of a secret to recognise it, never enough to reuse it. */
export const maskValue = (value: string): string => {
  if (value === '') return '(empty)'
  if (value.length <= 8) return `${'*'.repeat(value.length)} (${value.length} chars)`
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length} chars)`
}

export type EnvDiff = {
  /** In the local file, absent on the host. */
  missing: string[]
  /** On both sides with different values. */
  different: { key: string; local: string; host: string }[]
  /** On the host, absent locally. Reported only — never deleted. */
  hostOnly: string[]
  /** Local key with a blank value: skipped, blanking a host secret is worse than leaving it. */
  empty: string[]
  /** On the host but unreadable (`sensitive` type), so no comparison is possible. */
  unverifiable: string[]
}

export type EnvDiffInput = {
  local: Record<string, string>
  /** Values from `vercel env pull` — readable only. */
  host: Record<string, string>
  /** Every key name the host reports for the target, including unreadable ones. */
  hostKeys: readonly string[]
  /** Treat a `[SENSITIVE]` host value as rewritable instead of unverifiable. */
  rewriteSensitive?: boolean
}

/**
 * Three actionable buckets (missing, different) and three informational ones
 * (hostOnly, empty, unverifiable). A key that is on the host but unreadable —
 * absent from the pull, or present as the `[SENSITIVE]` placeholder — is never
 * reported as missing: that is the false positive that would overwrite a real
 * secret with whatever the local file happens to hold. `rewriteSensitive` opts
 * in to rewriting those rows as readable config values.
 */
export const diffEnv = ({
  local,
  host,
  hostKeys,
  rewriteSensitive = false,
}: EnvDiffInput): EnvDiff => {
  const unreadable = hostKeys.filter(
    (key) => !(key in host) || (host[key] === SENSITIVE_PLACEHOLDER && !rewriteSensitive),
  )
  const missing: string[] = []
  const different: { key: string; local: string; host: string }[] = []
  const empty: string[] = []
  const unverifiable: string[] = []

  for (const key of Object.keys(local)) {
    const value = local[key]
    if (unreadable.indexOf(key) !== -1) {
      unverifiable.push(key)
      continue
    }
    if (value.trim() === '') {
      empty.push(key)
      continue
    }
    if (!(key in host)) {
      missing.push(key)
      continue
    }
    if (host[key] !== value) {
      different.push({ key, local: value, host: host[key] })
    }
  }

  return {
    missing: missing.sort(),
    different,
    hostOnly: hostKeys.filter((key) => !(key in local)).sort(),
    empty,
    unverifiable,
  }
}

/** Anything the script would write. */
export const hasWrites = (diff: EnvDiff): boolean =>
  diff.missing.length > 0 || diff.different.length > 0
