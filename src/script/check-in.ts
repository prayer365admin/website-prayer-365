/*
 * Dev/QA stand-in for the mobile app's church check-in. Logs in as a mobile user and calls the
 * real `POST /mobile/churches/:churchId/check-ins`, so it feeds the website Home "Days in prayer"
 * streak exactly like the app. The server always records TODAY in the church's timezone; a second
 * check-in the same day is deduplicated. Needs `bun dev` running. Never point it at production.
 *
 *   bun run checkin:create --help
 */
import { parseArgs } from 'node:util'
import { login, mobileApi, out, resolveChurch } from './mobile-api'

const HELP = `Check in at a church today through the mobile API.

Usage: bun run checkin:create [options]

  --base <url>          API base (default http://localhost:3000/api/v1)
  --user <email>        Mobile account (default believer@example.com)
  --password <pw>       Password (default Test123!)
  --church <id|name>    Church id, or a name to search (default "Tallinn Demo Church")
  -h, --help            Show this help

Examples
  bun run checkin:create
  bun run checkin:create --user me@example.com --password 'Secret1!' --church "Hope Church"`

const { values: opt } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:3000/api/v1' },
    user: { type: 'string', default: 'believer@example.com' },
    password: { type: 'string', default: 'Test123!' },
    church: { type: 'string', default: 'Tallinn Demo Church' },
    help: { type: 'boolean', short: 'h', default: false },
  },
})

const main = async () => {
  if (opt.help) return out(HELP)
  const target = { base: opt.base!, user: opt.user!, password: opt.password! }
  const token = await login(target, 'check-in-script')
  const church = await resolveChurch(target.base, token, opt.church!)

  const { status, json } = await mobileApi(target.base)(
    `/mobile/churches/${encodeURIComponent(church.id)}/check-ins`,
    { method: 'POST', body: '{}', headers: { 'Idempotency-Key': `script-${crypto.randomUUID()}` } },
    token,
  )
  if (status === 200)
    out(
      `✔ ${opt.user} checked in at ${church.name} for ${json.result.localDate} (church local day)`,
    )
  else out(`✖ ${status} → ${json.error_code ?? json.error}: ${json.details ?? ''}`)
}

main()
