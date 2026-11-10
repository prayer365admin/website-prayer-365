/* eslint-disable no-console -- ops CLI: prints the plan, the created endpoint and the verdict on stdout */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'

import dotenv from 'dotenv'

import {
  MAX_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_PATH,
  assertKeyMode,
  buildProdEnvBlock,
  findEndpoint,
  maskSecret,
  mergeEvents,
  missingEvents,
  normalizeEndpointUrl,
} from './stripe-migrate-rules'
import type { WebhookEndpointLike } from './stripe-migrate-rules'

/*
 * Stripe staging -> prod webhook migration (two separate Stripe accounts).
 *
 *   bun src/script/stripe-migrate-prod.ts                    # dry run, prints the plan
 *   bun src/script/stripe-migrate-prod.ts --apply             # creates the live endpoint
 *
 * What it moves: the webhook endpoint only (URL + event list) plus the env
 * values prod needs. Test-mode customers/donations are NOT copied — they would
 * poison live reporting.
 *
 * Sources:
 *   staging key  --staging-key | STAGING_STRIPE_SECRET_KEY | .env.staging:STRIPE_SECRET_KEY
 *   prod key     --prod-key    | PROD_STRIPE_SECRET_KEY
 *   prod URL     --url         | default: BASE_URL from .env.prod + /api/v1/webhooks/stripe
 *
 * Reads only unless --apply. The signing secret (whsec_…) only exists in the
 * create response, so it is written to `.hermes/stripe/prod-stripe.env` (0600)
 * and never printed in full.
 */

const API = 'https://api.stripe.com/v1'
const DEFAULT_ENV_FILE = '.hermes/stripe/prod-stripe.env'

interface EndpointResponse extends WebhookEndpointLike {
  enabled_events: string[]
  status: string
  secret?: string
}

interface AccountResponse {
  id: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

interface ListResponse<T> {
  data: T[]
  has_more: boolean
}

type Flags = {
  apply: boolean
  url?: string
  stagingUrl?: string
  stagingKey?: string
  prodKey?: string
  out: string
}

const parseFlags = (argv: string[]): Flags => {
  const flags: Flags = { apply: false, out: DEFAULT_ENV_FILE }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = (): string => {
      const inline = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : ''
      if (inline) return inline
      const next = argv[index + 1]
      if (!next || next.startsWith('--')) throw new Error(`${arg} needs a value`)
      index += 1
      return next
    }
    if (arg === '--apply') flags.apply = true
    else if (arg.startsWith('--url')) flags.url = value()
    else if (arg.startsWith('--staging-url')) flags.stagingUrl = value()
    else if (arg.startsWith('--staging-key')) flags.stagingKey = value()
    else if (arg.startsWith('--prod-key')) flags.prodKey = value()
    else if (arg.startsWith('--out')) flags.out = value()
    else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: bun src/script/stripe-migrate-prod.ts [--apply] [--url <prod-webhook-url>]',
          '',
          '  --apply               actually create the endpoint on the prod (live) account',
          '  --url <url>           prod webhook URL (default: BASE_URL from .env.prod + ' +
            STRIPE_WEBHOOK_PATH +
            ')',
          '  --staging-url <url>   copy events from this staging endpoint (default: first one on ' +
            STRIPE_WEBHOOK_PATH +
            ')',
          '  --staging-key <key>   staging secret key (sk_test_…)',
          '  --prod-key <key>      prod secret key (sk_live_…)',
          '  --out <path>          where to write prod env values (default: ' +
            DEFAULT_ENV_FILE +
            ')',
        ].join('\n'),
      )
      process.exit(0)
    } else throw new Error(`unknown flag: ${arg}`)
  }
  return flags
}

const readEnvValue = async (file: string, key: string): Promise<string | undefined> => {
  try {
    const text = await fs.readFile(resolve(process.cwd(), file), 'utf8')
    return dotenv.parse(text)[key]
  } catch {
    return undefined
  }
}

const stripeRequest = async <T>(
  key: string,
  path: string,
  options: { method?: string; body?: URLSearchParams; idempotencyKey?: string } = {},
): Promise<T> => {
  const { method = 'GET', body, idempotencyKey } = options
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` }
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${API}${path}`, { method, headers, body: body?.toString() })
  const payload = (await response.json()) as { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(
      `Stripe ${response.status} ${method} ${path}: ${payload.error?.message ?? 'unknown error'}`,
    )
  }
  return payload as T
}

const listEndpoints = async (key: string): Promise<EndpointResponse[]> => {
  const page = await stripeRequest<ListResponse<EndpointResponse>>(
    key,
    '/webhook_endpoints?limit=100',
  )
  return page.data
}

const main = async (): Promise<void> => {
  const flags = parseFlags(process.argv.slice(2))

  const prodBaseUrl = await readEnvValue('.env.prod', 'BASE_URL')
  const prodUrl =
    flags.url?.trim() ||
    (prodBaseUrl ? `${prodBaseUrl.replace(/\/+$/, '')}${STRIPE_WEBHOOK_PATH}` : '')
  if (!prodUrl) throw new Error('no prod URL: pass --url, or set BASE_URL in .env.prod')

  const stagingKey =
    flags.stagingKey?.trim() ||
    process.env.STAGING_STRIPE_SECRET_KEY?.trim() ||
    (await readEnvValue('.env.staging', 'STRIPE_SECRET_KEY'))?.trim() ||
    ''
  const prodKey = flags.prodKey?.trim() || process.env.PROD_STRIPE_SECRET_KEY?.trim() || ''
  if (!stagingKey)
    throw new Error(
      'no staging key: pass --staging-key, set STAGING_STRIPE_SECRET_KEY, or fill .env.staging',
    )
  if (!prodKey)
    throw new Error(
      'no prod key: pass --prod-key or set PROD_STRIPE_SECRET_KEY (must be sk_live_…)',
    )

  // Guard rails first: a live key on the staging side (or the reverse) means the
  // operator mixed up accounts, and the next step writes to the wrong account.
  assertKeyMode('staging key', stagingKey, 'test')
  assertKeyMode('prod key', prodKey, 'live')

  console.log(`staging key  ${maskSecret(stagingKey)} (test)`)
  console.log(`prod key     ${maskSecret(prodKey)} (live)`)
  console.log(`prod url     ${prodUrl}`)
  console.log('')

  const stagingEndpoints = await listEndpoints(stagingKey)
  const source = flags.stagingUrl
    ? findEndpoint(stagingEndpoints, flags.stagingUrl)
    : stagingEndpoints.find((endpoint) =>
        normalizeEndpointUrl(endpoint.url).endsWith(STRIPE_WEBHOOK_PATH),
      )

  if (flags.stagingUrl && !source) throw new Error(`no staging endpoint at ${flags.stagingUrl}`)

  const events = mergeEvents(source?.enabled_events)
  if (events.length > MAX_WEBHOOK_EVENTS) {
    throw new Error(
      `merged event list has ${events.length} events, Stripe allows ${MAX_WEBHOOK_EVENTS}`,
    )
  }

  console.log(
    source
      ? `source       ${source.id} ${source.url} (${source.enabled_events.length} events)`
      : 'source       none found on staging — falling back to the app event list from docs/STRIPE.md',
  )
  console.log(`events       ${events.length}`)
  for (const event of events) console.log(`  - ${event}`)
  console.log('')

  const prodEndpoints = await listEndpoints(prodKey)
  const existing = findEndpoint(prodEndpoints, prodUrl)
  if (existing) {
    const missing = missingEvents(existing.enabled_events)
    console.log(`already there  ${existing.id} ${existing.url} [${existing.status}]`)
    if (missing.length === 0) {
      console.log('verdict        prod already listens to every required event — nothing to do')
      return
    }
    console.log(`missing events ${missing.join(', ')}`)
    console.log('')
    console.log('Next: add those events in the dashboard (Developers > Webhooks > this endpoint),')
    console.log('or run: stripe webhook_endpoints update ' + existing.id + ' \\')
    console.log(
      '        ' + missing.map((event) => `--enabled_events[]=${event}`).join(' \\\n        '),
    )
    return
  }

  const sameHost = prodEndpoints.filter(
    (endpoint) => new URL(endpoint.url).host === new URL(prodUrl).host,
  )
  if (sameHost.length) {
    console.log('note           prod already has endpoints on this host (different path):')
    for (const endpoint of sameHost) console.log(`  - ${endpoint.id} ${endpoint.url}`)
    console.log('')
  }

  const account = await stripeRequest<AccountResponse>(prodKey, '/account')
  console.log(`prod account   ${account.id}`)
  console.log(
    `charges        ${account.charges_enabled ? 'enabled' : 'DISABLED (live keys need an activated account)'}`,
  )
  console.log('')

  if (!flags.apply) {
    console.log('DRY RUN — would create:')
    console.log(`  POST ${API}/webhook_endpoints`)
    console.log(`  url            ${prodUrl}`)
    console.log(`  events         ${events.join(',')}`)
    console.log('')
    console.log('Re-run with --apply to create it.')
    return
  }

  const idempotencyKey = createHash('sha256')
    .update(`webhook:${prodUrl}:${events.join(',')}`)
    .digest('hex')
  const body = new URLSearchParams()
  body.set('url', prodUrl)
  body.set('description', 'PRAYER 365 donations (migrated from staging)')
  for (const event of events) body.append('enabled_events[]', event)

  const created = await stripeRequest<EndpointResponse>(prodKey, '/webhook_endpoints', {
    method: 'POST',
    body,
    idempotencyKey,
  })

  // Read back: a 200 on create is not proof the endpoint is what we asked for.
  const verified = await stripeRequest<EndpointResponse>(
    prodKey,
    `/webhook_endpoints/${created.id}`,
  )
  const urlOk = normalizeEndpointUrl(verified.url) === normalizeEndpointUrl(prodUrl)
  const eventsOk = missingEvents(verified.enabled_events).length === 0
  if (!urlOk || !eventsOk) {
    throw new Error(
      `created ${created.id} but read-back mismatch (url ${verified.url}, events ${verified.enabled_events.length})`,
    )
  }

  console.log(`created        ${verified.id} [${verified.status}]`)
  console.log(`url            ${verified.url}`)
  console.log(`events         ${verified.enabled_events.length} (all required present)`)
  console.log('')

  if (!created.secret) {
    console.log(
      'WARNING: Stripe did not return a signing secret. Roll one in the dashboard to get whsec_…',
    )
    return
  }

  const outPath = resolve(process.cwd(), flags.out)
  await fs.mkdir(dirname(outPath), { recursive: true })
  await fs.writeFile(
    outPath,
    buildProdEnvBlock({ secretKey: prodKey, webhookSecret: created.secret, accountId: account.id }),
    { mode: 0o600 },
  )

  console.log(`webhook secret ${maskSecret(created.secret)} -> ${flags.out} (0600)`)
  console.log('')
  console.log('Next steps:')
  console.log(`  1. merge ${flags.out} into .env.prod`)
  console.log('  2. bun run env:sync --target production --file .env.prod   (or seed AWS secrets)')
  console.log('  3. redeploy, then send one live test event from the dashboard')
}

main().catch((error: unknown) => {
  console.error(`FAILED: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
