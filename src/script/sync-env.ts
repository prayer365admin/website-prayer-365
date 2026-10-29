/* eslint-disable no-console -- ops CLI: prints the target, the diff and the verdict on stdout */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import type { Interface } from 'node:readline/promises'

import {
  VERCEL_ENVIRONMENTS,
  diffEnv,
  guessTargetEnvironment,
  hasWrites,
  maskValue,
  parseEnvText,
} from './sync-env-rules'
import type { EnvDiff, VercelEnvironment } from './sync-env-rules'

/*
 * Env sync: make one local `.env*` file true on the Vercel project.
 *
 *   bun run env:sync
 *   bun run env:sync -- --dry-run --target production --file .env.prod
 *
 * Why `vercel env pull` and not `vercel env ls --json`: the listing returns
 * `type: "encrypted"` and a ~1 KB opaque blob per value, so it cannot be diffed.
 * The pull decrypts into a temp directory that is 0700 and removed in `finally`.
 *
 * Reads local files only. Never deletes a host value: a key that exists only on
 * Vercel is reported, not mirrored away.
 */

const DEFAULT_SCOPE = 'catalyst-inertia-agency'
const DEFAULT_PROJECT = 'prayer-365-dashboard'

type Flags = {
  dryRun: boolean
  showValues: boolean
  yes: boolean
  rewriteSecrets: boolean
  target?: VercelEnvironment
  file?: string
  scope: string
  project: string
}

const asTarget = (value: string): VercelEnvironment => {
  const match = VERCEL_ENVIRONMENTS.filter((env) => env === value)[0]
  if (!match) throw new Error(`--target must be one of ${VERCEL_ENVIRONMENTS.join(', ')}`)
  return match
}

const parseFlags = (argv: string[]): Flags => {
  const flags: Flags = {
    dryRun: false,
    showValues: false,
    yes: false,
    rewriteSecrets: false,
    scope: DEFAULT_SCOPE,
    project: DEFAULT_PROJECT,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const sep = arg.indexOf('=')
    const name = sep === -1 ? arg : arg.slice(0, sep)
    const inline = sep === -1 ? undefined : arg.slice(sep + 1)
    const value = (): string => {
      if (inline !== undefined) return inline
      const next = argv[index + 1]
      if (next === undefined) throw new Error(`${name} needs a value`)
      index += 1
      return next
    }

    if (name === '--dry-run') {
      flags.dryRun = true
    } else if (name === '--show-values') {
      flags.showValues = true
    } else if (name === '--yes') {
      flags.yes = true
    } else if (name === '--rewrite-secrets') {
      flags.rewriteSecrets = true
    } else if (name === '--target') {
      flags.target = asTarget(value())
    } else if (name === '--file') {
      flags.file = value()
    } else if (name === '--scope') {
      flags.scope = value()
    } else if (name === '--project') {
      flags.project = value()
    } else {
      throw new Error(
        `Unknown flag ${name}. Use --dry-run, --show-values, --yes, --rewrite-secrets, --target, --file, --scope, --project.`,
      )
    }
  }

  return flags
}

type RunResult = { ok: boolean; stdout: string; stderr: string }

/** Run the Vercel CLI without a TTY; `input` is piped to its stdin (used by `env add`). */
const runVercel = (args: string[], input?: string): Promise<RunResult> =>
  new Promise((resolve) => {
    const child = spawn('vercel', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', (error: Error) => {
      resolve({ ok: false, stdout, stderr: error.message })
    })
    child.on('close', (code: number | null) => {
      resolve({ ok: code === 0, stdout, stderr })
    })
    child.stdin.on('error', () => {
      /* the CLI closed the pipe first — the exit code already tells the story */
    })
    child.stdin.end(input ?? '')
  })

const confirm = async (rl: Interface, question: string, skip: boolean): Promise<boolean> => {
  if (skip) return true
  const answer = (await rl.question(`  ${question} [y/N] `)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}

const listEnvFiles = async (): Promise<string[]> => {
  const entries = await fs.readdir(process.cwd(), { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('.env'))
    .map((entry) => entry.name)
    .sort()
}

const pickFile = async (rl: Interface, files: string[], preset?: string): Promise<string> => {
  if (preset) {
    if (files.indexOf(preset) === -1)
      throw new Error(`${preset} is not a .env* file at the repo root`)
    console.log(`  Local file   ${preset}`)
    return preset
  }
  if (files.length === 0) throw new Error('No .env* file at the repo root')
  if (files.length === 1) {
    console.log(`  Local file   ${files[0]} (only one found)`)
    return files[0]
  }

  console.log('  Local env files:')
  files.forEach((file, index) => {
    console.log(`    [${index + 1}] ${file}  ->  ${guessTargetEnvironment(file)} (guess)`)
  })
  const answer = (await rl.question('  Compare which file? [1] ')).trim()
  const chosen = files[answer === '' ? 0 : Number(answer) - 1]
  if (!chosen) throw new Error('No such option')
  return chosen
}

const chooseTarget = async (
  rl: Interface,
  file: string,
  flags: Flags,
): Promise<VercelEnvironment> => {
  if (flags.target) return flags.target
  const guess = guessTargetEnvironment(file)
  const answer = (
    await rl.question(
      `  Vercel environment for ${file}? [production|preview|development] (${guess}) `,
    )
  ).trim()
  return answer === '' ? guess : asTarget(answer)
}

/**
 * Decrypt the target environment into a 0700 temp directory, parse, remove.
 * Returns only readable values: `sensitive` variables never appear here.
 */
const pullHost = async (
  target: VercelEnvironment,
  flags: Flags,
): Promise<Record<string, string>> => {
  const dir = await fs.mkdtemp(join(tmpdir(), 'prayer365-env-'))
  try {
    const file = join(dir, `.env.${target}`)
    const result = await runVercel([
      'env',
      'pull',
      file,
      `--environment=${target}`,
      '--yes',
      `--project=${flags.project}`,
      `--scope=${flags.scope}`,
    ])
    if (!result.ok)
      throw new Error(`vercel env pull failed: ${(result.stderr || result.stdout).trim()}`)
    return parseEnvText(await fs.readFile(file, 'utf8'))
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

/** Every key name the host reports for the target, readable or not. */
const listHostKeys = async (target: VercelEnvironment, flags: Flags): Promise<string[]> => {
  const result = await runVercel([
    'env',
    'ls',
    target,
    '--json',
    `--project=${flags.project}`,
    `--scope=${flags.scope}`,
  ])
  if (!result.ok) return []
  try {
    const parsed = JSON.parse(result.stdout) as { envs?: { key?: string; target?: string[] }[] }
    return (parsed.envs ?? [])
      .filter((row) => (row.target ?? []).indexOf(target) !== -1 && row.key !== undefined)
      .map((row) => row.key as string)
  } catch {
    return []
  }
}

const printDiff = (diff: EnvDiff, local: Record<string, string>, flags: Flags): void => {
  const show = (value: string): string => (flags.showValues ? value : maskValue(value))
  console.log('')
  console.log(`  MISSING (${diff.missing.length})        local only — would be added`)
  diff.missing.forEach((key) => console.log(`    + ${key} = ${show(local[key])}`))

  console.log(
    `  DIFFERENT (${diff.different.length})      both sides, other value — would be replaced`,
  )
  diff.different.forEach((item) =>
    console.log(`    ~ ${item.key}  ${show(item.host)}  ->  ${show(item.local)}`),
  )

  if (diff.hostOnly.length > 0) {
    console.log(`  HOST ONLY (${diff.hostOnly.length})      reported, never deleted`)
    diff.hostOnly.forEach((key) => console.log(`    · ${key}`))
  }
  if (diff.unverifiable.length > 0) {
    console.log(
      `  CANNOT VERIFY (${diff.unverifiable.length})   stored as a secret — value unreadable`,
    )
    diff.unverifiable.forEach((key) => console.log(`    ? ${key}`))
    console.log('    (re-run with --rewrite-secrets to store them as readable config values)')
  }
  if (diff.empty.length > 0) {
    console.log(`  SKIPPED EMPTY (${diff.empty.length})     blank locally — never written`)
    diff.empty.forEach((key) => console.log(`    - ${key}`))
  }
}

const printDryRun = (diff: EnvDiff, target: VercelEnvironment): void => {
  diff.missing.forEach((key) => console.log(`    vercel env add ${key} ${target} << value`))
  diff.different.forEach((item) => {
    console.log(`    vercel env rm ${item.key} ${target} --yes`)
    console.log(`    vercel env add ${item.key} ${target} << value`)
  })
}

const addKey = async (
  key: string,
  value: string,
  target: VercelEnvironment,
  flags: Flags,
): Promise<boolean> => {
  const result = await runVercel(
    [
      'env',
      'add',
      key,
      target,
      '--type=config',
      `--project=${flags.project}`,
      `--scope=${flags.scope}`,
      '--force',
    ],
    `${value}\n`,
  )
  if (!result.ok) console.log(`      ${(result.stderr || result.stdout).trim().split('\n')[0]}`)
  return result.ok
}

const removeKey = async (
  key: string,
  target: VercelEnvironment,
  flags: Flags,
): Promise<boolean> => {
  const result = await runVercel([
    'env',
    'rm',
    key,
    target,
    '--yes',
    `--project=${flags.project}`,
    `--scope=${flags.scope}`,
  ])
  if (!result.ok) console.log(`      ${(result.stderr || result.stdout).trim().split('\n')[0]}`)
  return result.ok
}

const applyDiff = async (
  diff: EnvDiff,
  local: Record<string, string>,
  target: VercelEnvironment,
  flags: Flags,
): Promise<number> => {
  let failures = 0

  for (const key of diff.missing) {
    const ok = await addKey(key, local[key], target, flags)
    console.log(`    ${ok ? 'OK  ' : 'FAIL'} add      ${key}`)
    if (!ok) failures += 1
  }

  for (const item of diff.different) {
    const removed = await removeKey(item.key, target, flags)
    const added = removed ? await addKey(item.key, item.local, target, flags) : false
    console.log(`    ${added ? 'OK  ' : 'FAIL'} replace  ${item.key}`)
    if (!added) failures += 1
  }

  return failures
}

const main = async (): Promise<number> => {
  const flags = parseFlags(process.argv.slice(2))
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    console.log('')
    console.log('ENV SYNC   local .env  ->  Vercel')
    console.log('')
    console.log(`  Team     ${flags.scope}`)
    console.log(`  Project  ${flags.project}`)
    if (!(await confirm(rl, 'Target correct?', flags.yes))) {
      console.log('  Aborted.')
      return 0
    }

    const files = await listEnvFiles()
    const file = await pickFile(rl, files, flags.file)
    const target = await chooseTarget(rl, file, flags)

    const local = parseEnvText(await fs.readFile(file, 'utf8'))
    if (Object.keys(local).length === 0) {
      console.log(`  ${file} holds no keys — nothing to compare.`)
      return 0
    }

    console.log('')
    console.log(`  Pulling ${target} …`)
    const host = await pullHost(target, flags)
    const hostKeys = await listHostKeys(target, flags)
    const diff = diffEnv({ local, host, hostKeys, rewriteSensitive: flags.rewriteSecrets })
    printDiff(diff, local, flags)

    if (!hasWrites(diff)) {
      console.log('')
      console.log(`  In sync with ${target} — nothing to write.`)
      return 0
    }

    if (flags.dryRun) {
      console.log('')
      console.log('  DRY RUN — commands that would run:')
      printDryRun(diff, target)
      return 0
    }

    console.log('')
    const total = diff.missing.length + diff.different.length
    if (!(await confirm(rl, `Write ${total} change(s) to ${target.toUpperCase()}?`, flags.yes))) {
      console.log('  Aborted.')
      return 0
    }

    const failures = await applyDiff(diff, local, target, flags)

    console.log('')
    console.log(`  Reading ${target} back …`)
    const after = diffEnv({
      local,
      host: await pullHost(target, flags),
      hostKeys: await listHostKeys(target, flags),
      rewriteSensitive: flags.rewriteSecrets,
    })
    console.log(`  Read-back: ${after.missing.length} missing, ${after.different.length} different`)
    if (hasWrites(after)) {
      console.log('  FAIL host does not match the local file yet — inspect the errors above.')
      return 1
    }
    console.log(
      `  OK   ${target} matches ${file}. REDEPLOY so the running build picks up new values.`,
    )
    return failures > 0 ? 1 : 0
  } finally {
    rl.close()
  }
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((error: unknown) => {
    console.error(`  FAIL ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
