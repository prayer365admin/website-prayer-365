/*
 * Dev/QA stand-in for the mobile app's request form (F7RQ). Logs in as a
 * mobile user and calls the real `POST /mobile/churches/:churchId/requests`,
 * so validation, idempotency and the rate limit behave exactly as they will
 * for the app. Needs `bun dev` running. Never point it at production.
 *
 *   bun run request:submit --help
 */
import { parseArgs } from 'node:util'

const HELP = `Submit prayer/pastoral/meeting requests through the mobile API.

Usage: bun run request:submit [options]

Target
  --base <url>          API base (default http://localhost:3000/api/v1)
  --user <email>        Mobile account (default believer@example.com)
  --password <pw>       Password (default Test123!)
  --church <id|name>    Church id, or a name to search (default "Tallinn Demo Church")

Request (one submission)
  --kind <k>            prayer | pastoral | meeting (default prayer)
  --subject <text>      Required for prayer; pastoral "request type" label (R7)
  --message <text>      Default "Sample request message."
  --classification <c>  PRIVATE | STANDARD (optional)
  --contact <method>    Preferred contact method (default email)
  --email <addr>        Optional contact email
  --phone <number>      Optional contact phone
  --availability <text> Optional availability
  --key <key>           Idempotency-Key (default: random)
  --no-key              Send without an Idempotency-Key (expect 400)

Modes
  --samples             Submit 4 presets: standard prayer, private prayer,
                        pastoral and meeting (each with its own key)
  --repeat <n>          Send the same request n times with the SAME key
                        (replay: every response should be identical)
  --count <n>           Send n requests, each with a NEW key (rate limit:
                        expect 429 after the limit)
  -h, --help            Show this help

Examples
  bun run request:submit --samples
  bun run request:submit --kind pastoral --subject "Speak with a pastor" \\
    --message "Need to talk" --contact phone --phone "+372 5555 0000"
  bun run request:submit --subject Replay --key demo-1 --repeat 2
  bun run request:submit --subject Burst --count 6`

const { values: opt } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000/api/v1' },
    user: { type: 'string', default: 'believer@example.com' },
    password: { type: 'string', default: 'Test123!' },
    church: { type: 'string', default: 'Tallinn Demo Church' },
    kind: { type: 'string', default: 'prayer' },
    subject: { type: 'string' },
    message: { type: 'string', default: 'Sample request message.' },
    classification: { type: 'string' },
    contact: { type: 'string', default: 'email' },
    email: { type: 'string' },
    phone: { type: 'string' },
    availability: { type: 'string' },
    key: { type: 'string' },
    'no-key': { type: 'boolean', default: false },
    samples: { type: 'boolean', default: false },
    repeat: { type: 'string' },
    count: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

type Body = Record<string, string>

// Plain CLI output (the app logger writes JSON for services).
const out = (line: string) => process.stdout.write(`${line}\n`)

const fail = (msg: string): never => {
  process.stderr.write(`✖ ${msg}\n`)
  process.exit(1)
}

const api = async (path: string, init: RequestInit = {}, token?: string) => {
  const res = await fetch(`${opt.base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  }).catch(() => fail(`Cannot reach ${opt.base}. Is \`bun dev\` running?`))
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const login = async () => {
  const { status, json } = await api('/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: opt.user,
      password: opt.password,
      installationId: 'submit-request-script',
    }),
  })
  if (status !== 200) fail(`Login failed for ${opt.user} (${status}): ${json.details ?? ''}`)
  return json.result.accessToken as string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const resolveChurch = async (token: string) => {
  const church = opt.church!
  if (UUID.test(church)) return { id: church, name: church }
  const { status, json } = await api(
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

let sent = 0
const submit = async (token: string, churchId: string, body: Body, key: string | null) => {
  const { status, json } = await api(
    `/mobile/churches/${encodeURIComponent(churchId)}/requests`,
    { method: 'POST', body: JSON.stringify(body), headers: key ? { 'Idempotency-Key': key } : {} },
    token,
  )
  sent++
  const label = `#${sent} ${body.kind}${body.subject ? ` "${body.subject}"` : ''} key=${key ?? '(none)'}`
  if (status === 200)
    out(`✔ ${status} ${label} → id=${json.result.id} at ${json.result.createdAt}`)
  else out(`✖ ${status} ${label} → ${json.error_code ?? json.error}: ${json.details ?? ''}`)
  return status
}

const newKey = () => `script-${crypto.randomUUID()}`

const fromOptions = (): Body => {
  const body: Body = { kind: opt.kind!, message: opt.message!, contactMethod: opt.contact! }
  if (opt.subject) body.subject = opt.subject
  if (opt.classification) body.classification = opt.classification.toUpperCase()
  if (opt.email) body.email = opt.email
  if (opt.phone) body.phone = opt.phone
  if (opt.availability) body.availability = opt.availability
  return body
}

const SAMPLES: Body[] = [
  {
    kind: 'prayer',
    subject: 'Script standard prayer',
    message: 'Please pray for our family this week.',
    classification: 'STANDARD',
    contactMethod: 'email',
    email: 'standard.sender@example.com',
  },
  {
    kind: 'prayer',
    subject: 'Script private prayer',
    message: 'A private matter I would like prayer for.',
    classification: 'PRIVATE',
    contactMethod: 'phone',
    phone: '+372 5555 0101',
    email: 'private.sender@example.com',
  },
  {
    kind: 'pastoral',
    subject: 'Pastoral care',
    message: 'I would like to talk with a pastor about a difficult time.',
    contactMethod: 'phone',
    phone: '+372 5555 0202',
    availability: 'Weekday evenings',
  },
  {
    kind: 'meeting',
    subject: 'Meeting request',
    message: 'Could we meet after the Sunday service?',
    contactMethod: 'email',
    email: 'meeting.sender@example.com',
    availability: 'Sunday after 12:00',
  },
]

const main = async () => {
  if (opt.help) return out(HELP)
  const token = await login()
  const church = await resolveChurch(token)
  out(`As ${opt.user} → ${church.name} (${church.id})\n`)

  if (opt.samples) {
    for (const body of SAMPLES) await submit(token, church.id, body, newKey())
    return
  }

  const body = fromOptions()
  const repeat = Number(opt.repeat ?? 0)
  const count = Number(opt.count ?? 0)

  if (repeat > 0) {
    const key = opt.key ?? newKey()
    for (let i = 0; i < repeat; i++) await submit(token, church.id, body, key)
  } else if (count > 0) {
    for (let i = 0; i < count; i++) await submit(token, church.id, body, newKey())
  } else {
    await submit(token, church.id, body, opt['no-key'] ? null : (opt.key ?? newKey()))
  }
}

main()
