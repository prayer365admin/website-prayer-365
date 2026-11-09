/* eslint-disable no-console -- ops CLI: prints the target, the diff and the verdict */
/*
 * Seed the worker Secrets Manager entries from a local .env file.
 *
 *   bunx tsx infra/scripts/seed-secrets.ts --env catatia
 *   bunx tsx infra/scripts/seed-secrets.ts --env prayer-365 --dry-run --show-values
 *   bunx tsx infra/scripts/seed-secrets.ts --env catatia --only stripe-secret-key
 *
 * Why a script: the data stack only creates empty containers (CDK fills them with a
 * random placeholder), and the Lambda env vars are CloudFormation dynamic references
 * that freeze the value at deploy time. So the secret must be written BEFORE the
 * worker deploy, from a file the operator already maintains.
 *
 * Rules (read the diff, confirm, then write):
 *   - every secret must be buildable from the chosen file, otherwise nothing runs
 *   - values are masked unless --show-values
 *   - `unchanged` values are never written
 *   - --dry-run stops after the table
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { randomBytes } from 'node:crypto'
import { parse as parseEnv } from 'dotenv'
import {
  DEFAULT_ENV_FILE,
  DEFAULT_PROFILE,
  SECRET_SPECS,
  classify,
  mask,
  type SecretSpec,
} from './seed-secrets-rules'

type Flags = {
  env: string
  file?: string
  profile?: string
  region?: string
  dryRun: boolean
  showValues: boolean
  yes: boolean
  checkOnly: boolean
  printDeviceKey: boolean
  allowFile: boolean
  only?: string[]
}

const USAGE = `Usage: seed-secrets.ts --env <name> [options]

  --env <name>          environment config name (catatia | prayer-365)
  --file <path>         local env file (default: ${Object.entries(DEFAULT_ENV_FILE)
    .map(([env, file]) => `${env}=${file}`)
    .join(', ')})
  --profile <name>      AWS profile (default: ${Object.entries(DEFAULT_PROFILE)
    .map(([env, profile]) => `${env}=${profile ?? 'credentials from the env file'}`)
    .join(', ')})
  --region <name>       AWS region (default: AWS_REGION from the env file)
  --only <a,b>          seed only these secrets
  --allow-file          accept a --file that is not the environment's default
  --dry-run             print the diff and stop
  --check-only          print the diff and a mismatch count, never write
  --show-values         print full values instead of a mask
  --yes                 skip the confirmation prompt
  --print-device-key    print a fresh base64 32-byte key and exit
  --help                this text`

const flags = (() => {
  const argv = process.argv.slice(2)
  const parsed: Flags = {
    env: '',
    dryRun: false,
    showValues: false,
    yes: false,
    checkOnly: false,
    printDeviceKey: false,
    allowFile: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const sep = arg.indexOf('=')
    const name = sep === -1 ? arg : arg.slice(0, sep)
    const inline = sep === -1 ? undefined : arg.slice(sep + 1)
    const next = (): string => {
      if (inline !== undefined) return inline
      const value = argv[index + 1]
      if (value === undefined) throw new Error(`${name} needs a value`)
      index += 1
      return value
    }

    if (name === '--env') parsed.env = next()
    else if (name === '--file') parsed.file = next()
    else if (name === '--profile') parsed.profile = next()
    else if (name === '--region') parsed.region = next()
    else if (name === '--only')
      parsed.only = next()
        .split(',')
        .map((entry) => entry.trim())
    else if (name === '--dry-run') parsed.dryRun = true
    else if (name === '--allow-file') parsed.allowFile = true
    else if (name === '--check-only') parsed.checkOnly = true
    else if (name === '--show-values') parsed.showValues = true
    else if (name === '--yes') parsed.yes = true
    else if (name === '--print-device-key') parsed.printDeviceKey = true
    else if (name === '--help' || name === '-h') {
      console.log(USAGE)
      process.exit(0)
    } else {
      throw new Error(`Unknown flag ${name}\n\n${USAGE}`)
    }
  }

  return parsed
})()

if (flags.printDeviceKey) {
  console.log(randomBytes(32).toString('base64'))
  process.exit(0)
}

if (!flags.env) {
  console.error(`--env is required\n\n${USAGE}`)
  process.exit(1)
}

const file = flags.file ?? DEFAULT_ENV_FILE[flags.env]
if (!file) throw new Error(`No default env file for "${flags.env}"; pass --file`)

// Writing the wrong file's values into /prayer365/<env>/ is the one mistake this
// tool must not make: .env.staging and .env both point at catatia, .env.prod at the
// client account. A deliberate override needs --allow-file.
// Compared as absolute paths: deploy.sh passes --file "$REPO_ROOT/$ENV_FILE", so a
// plain string compare would reject the default file itself.
const defaultFile = DEFAULT_ENV_FILE[flags.env]
if (defaultFile && resolve(file) !== resolve(defaultFile) && !flags.allowFile) {
  console.error(
    `\n  --file ${file} is not the default for "${flags.env}" (${defaultFile}).\n` +
      `  Its values would be written to /prayer365/${flags.env}/ in AWS.\n` +
      '  Use --allow-file if that is really what you want.\n',
  )
  process.exit(1)
}

const profile = flags.profile ?? DEFAULT_PROFILE[flags.env]
const local = parseEnv(readFileSync(file, 'utf8'))
const region = flags.region ?? local.AWS_REGION ?? local.AWS_DEFAULT_REGION

// The Firebase JSON may live in its own (gitignored) file: resolve it here so the
// rules module stays pure and free of filesystem access.
if (!local.FIREBASE_SERVICE_ACCOUNT && local.FIREBASE_SERVICE_ACCOUNT_FILE) {
  local.FIREBASE_SERVICE_ACCOUNT = readFileSync(local.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8')
}

const baseEnv: NodeJS.ProcessEnv = { ...process.env }
delete baseEnv.AWS_ACCESS_KEY_ID
delete baseEnv.AWS_SECRET_ACCESS_KEY
delete baseEnv.AWS_SESSION_TOKEN
if (!profile) {
  // No profile: authenticate with the keys from the chosen env file (catatia's admin).
  if (local.AWS_ACCESS_KEY_ID) baseEnv.AWS_ACCESS_KEY_ID = local.AWS_ACCESS_KEY_ID
  if (local.AWS_SECRET_ACCESS_KEY) baseEnv.AWS_SECRET_ACCESS_KEY = local.AWS_SECRET_ACCESS_KEY
  if (local.AWS_SESSION_TOKEN) baseEnv.AWS_SESSION_TOKEN = local.AWS_SESSION_TOKEN
}
if (region) baseEnv.AWS_REGION = region

const aws = (args: string[]): { ok: boolean; stdout: string; stderr: string } => {
  const all = [...args, '--output', 'json', '--no-cli-pager']
  if (profile) all.push('--profile', profile)
  if (region) all.push('--region', region)
  const result = spawnSync('aws', all, { encoding: 'utf8', env: baseEnv })
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

const secretId = (spec: SecretSpec) => `/prayer365/${flags.env}/${spec.name}`

/** null = container missing or no value yet. */
const readSecret = (spec: SecretSpec): string | null => {
  const result = aws(['secretsmanager', 'get-secret-value', '--secret-id', secretId(spec)])
  if (result.ok) {
    const parsed = JSON.parse(result.stdout) as { SecretString?: string }
    return parsed.SecretString ?? null
  }
  if (result.stderr.includes('ResourceNotFoundException')) return null
  throw new Error(`cannot read ${spec.name}: ${result.stderr.trim().split('\n')[0]}`)
}

const writeSecret = (spec: SecretSpec, value: string): void => {
  // file:// keeps the value out of argv (multi-line JSON, no shell quoting) and the
  // directory is 0700 with the file 0600 until it is removed.
  const dir = mkdtempSync(join(tmpdir(), 'prayer365-secret-'))
  const path = join(dir, 'value')
  try {
    writeFileSync(path, value, { mode: 0o600 })
    const result = aws([
      'secretsmanager',
      'put-secret-value',
      '--secret-id',
      secretId(spec),
      '--secret-string',
      `file://${path}`,
    ])
    if (!result.ok) {
      throw new Error(`write failed: ${result.stderr.trim().split('\n')[0]}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  const readBack = readSecret(spec)
  if (readBack !== value) throw new Error('read-back did not match what was written')
}

const selected = flags.only
  ? SECRET_SPECS.filter((spec) => flags.only?.includes(spec.name))
  : SECRET_SPECS
if (flags.only) {
  const unknown = flags.only.filter((name) => !SECRET_SPECS.some((spec) => spec.name === name))
  if (unknown.length) throw new Error(`--only has unknown secret(s): ${unknown.join(', ')}`)
}

console.log(`\n  environment   ${flags.env}`)
console.log(`  local file    ${file}`)
console.log(`  credentials   ${profile ? `profile ${profile}` : `keys from ${file}`}`)
console.log(`  region        ${region ?? '(profile default)'}\n`)

const planned: {
  spec: SecretSpec
  desired: string
  current: string | null
  status: ReturnType<typeof classify>
}[] = []
const errors: string[] = []

for (const spec of selected) {
  const built = spec.build(local)
  if ('error' in built) {
    errors.push(`${spec.name}: ${built.error}`)
    continue
  }
  const current = readSecret(spec)
  planned.push({
    spec,
    desired: built.value,
    current,
    status: classify(current, built.value, spec.isValid),
  })
}

if (errors.length) {
  console.error('  Missing or invalid values — nothing was written.\n')
  for (const error of errors) console.error(`    ${error}`)
  console.error(`\n  Provide them in ${file} and run again.\n`)
  process.exit(1)
}

const show = (value: string | null) => {
  if (value === null) return '(none)'
  // Multi-line payloads (service-account JSON) would break the table.
  const cell = value.includes('\n') ? `{json ${value.length}B}` : mask(value)
  if (!flags.showValues) return cell
  return value.replace(/\s+/g, ' ').slice(0, 48)
}

console.log(
  `  ${'secret'.padEnd(26)} ${'status'.padEnd(12)} ${'current'.padEnd(16)} ${'new'.padEnd(16)} source`,
)
console.log(
  `  ${'-'.repeat(26)} ${'-'.repeat(12)} ${'-'.repeat(16)} ${'-'.repeat(16)} ${'-'.repeat(6)}`,
)
for (const entry of planned) {
  console.log(
    `  ${entry.spec.name.padEnd(26)} ${entry.status.padEnd(12)} ${show(entry.current).padEnd(16)} ${show(entry.desired).padEnd(16)} ${entry.spec.keys.join(',')}`,
  )
}

const changes = planned.filter((entry) => entry.status !== 'unchanged')

if (flags.checkOnly) {
  console.log(`\n  secrets not matching ${file}: ${changes.length}/${planned.length}\n`)
  process.exit(0)
}

if (changes.length === 0) {
  console.log(`\n  Nothing to write: ${file} already matches all ${planned.length} secrets.\n`)
  process.exit(0)
}

if (flags.dryRun) {
  console.log(`\n  --dry-run: ${changes.length} secret(s) would be written, nothing was changed.\n`)
  process.exit(0)
}

const apply = async (): Promise<void> => {
  if (!flags.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = (await rl.question(`  Write these ${changes.length} secret(s)? [y/N] `))
      .trim()
      .toLowerCase()
    rl.close()
    if (answer !== 'y' && answer !== 'yes') {
      console.log('  Aborted, nothing was written.\n')
      return
    }
  }

  let written = 0
  for (const entry of changes) {
    try {
      writeSecret(entry.spec, entry.desired)
      written += 1
      console.log(`  wrote ${entry.spec.name} (${entry.status})`)
    } catch (error) {
      console.error(
        `  FAILED ${entry.spec.name}: ${error instanceof Error ? error.message : error}`,
      )
      process.exitCode = 2
      return
    }
  }

  console.log(`\n  ${written} secret(s) written. Deploy the workers next: the Lambda env vars are`)
  console.log('  CloudFormation references, so a running function keeps the old value until')
  console.log('  the stack is updated.\n')
}

apply().catch((error: unknown) => {
  console.error(`  ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
})
