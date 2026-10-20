/*
 * Shared helpers for the dev/QA scripts that stand in for the mobile app: plain CLI output,
 * the mobile API client, login, and church lookup. Needs `bun dev` running. Never point at production.
 */

export type ScriptTarget = { base: string; user: string; password: string }

// Plain CLI output (the app logger writes JSON for services).
export const out = (line: string) => process.stdout.write(`${line}\n`)

export const fail = (msg: string): never => {
  process.stderr.write(`✖ ${msg}\n`)
  process.exit(1)
}

export const mobileApi =
  (base: string) =>
  async (path: string, init: RequestInit = {}, token?: string) => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers as Record<string, string>),
      },
    }).catch(() => fail(`Cannot reach ${base}. Is \`bun dev\` running?`))
    const json = await res.json().catch(() => ({}))
    return { status: res.status, json }
  }

export const login = async ({ base, user, password }: ScriptTarget, installationId: string) => {
  const { status, json } = await mobileApi(base)('/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: user, password, installationId }),
  })
  if (status !== 200) fail(`Login failed for ${user} (${status}): ${json.details ?? ''}`)
  return json.result.accessToken as string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Church by id, or the best name match among approved churches. */
export const resolveChurch = async (base: string, token: string, church: string) => {
  if (UUID.test(church)) return { id: church, name: church }
  const { status, json } = await mobileApi(base)(
    `/mobile/churches?search=${encodeURIComponent(church)}&limit=10`,
    {},
    token,
  )
  if (status !== 200) fail(`Church search failed (${status})`)
  const list = json.result as { id: string; name: string }[]
  const match = list.find((c) => c.name.toLowerCase() === church.toLowerCase()) ?? list[0]
  if (!match) fail(`No approved church matches "${church}"`)
  return match
}
