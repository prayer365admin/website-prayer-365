import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandPrayerCatalogue } from '../../prisma/seeds/prayer-roles'

/*
 * Catalogue coverage guard.
 *
 * Every capability a route or controller enforces must exist as a permission row
 * somewhere, otherwise the check fails closed for EVERYONE — including the
 * super-admin `administrator` role, which is granted "every permission row that
 * exists" and therefore inherits the gap. That is exactly how
 * `prayer_country:delete` / `prayer_language:delete` shipped as 403s.
 *
 * The scanner reads the source (no execution of the route modules) and compares
 * the pairs it finds against the seeded catalogue plus the template rows in
 * prisma/seeds/permission.ts.
 */

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** All matches of a global regex, without relying on iterator downleveling. */
const matches = (text: string, pattern: RegExp): RegExpExecArray[] => {
  const out: RegExpExecArray[] = []
  let match = pattern.exec(text)
  while (match) {
    out.push(match)
    match = pattern.exec(text)
  }
  return out
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return entry === 'test' ? [] : walk(full)
    if (!/\.tsx?$/.test(entry)) return []
    if (/\.test\.tsx?$/.test(entry)) return []
    return [full]
  })

/** `requiredScope({ ... subject: 'x', action: 'y' ... })` → (x, y). */
const scopePairs = (text: string): [string, string][] => {
  const out: [string, string][] = []
  for (const match of matches(text, /requiredScope\(\{([^}]*)\}/g)) {
    const subject = /subject:\s*'([a-z_]+)'/.exec(match[1])
    const action = /action:\s*'([a-z]+)'/.exec(match[1])
    if (subject && action) out.push([subject[1], action[1]])
  }
  return out
}

/** `permission.readAny('x')` / `updateAny('x')` → (x, action). */
const anyPairs = (text: string): [string, string][] => {
  const out: [string, string][] = []
  for (const match of matches(text, /\.(read|create|update|delete)Any\('([a-z_]+)'\)/g)) {
    out.push([match[2], match[1]])
  }
  return out
}

/**
 * Template permission rows declared literally in seeds/permission.ts. The object
 * literals list `actions` before `subject`, so each block is matched as a unit.
 */
const templatePairs = (): Set<string> => {
  const text = readFileSync(path.join(ROOT, 'prisma/seeds/permission.ts'), 'utf8')
  const pairs = new Set<string>()
  for (const block of matches(text, /\{[^{}]*subject:\s*'([a-z_]+)'[^{}]*\}/g)) {
    const actions = /actions:\s*'([^']+)'/.exec(block[0])
    if (!actions) continue
    for (const action of actions[1].split(',')) pairs.add(`${block[1]}:${action.trim()}`)
  }
  return pairs
}

describe('permission catalogue covers every checked capability', () => {
  const catalogue = new Set(expandPrayerCatalogue().map((row) => `${row.subject}:${row.actions}`))

  it('every requiredScope subject:action exists in the seeded catalogue', () => {
    const missing: string[] = []
    for (const file of walk(SRC)) {
      for (const [subject, action] of scopePairs(readFileSync(file, 'utf8'))) {
        const key = `${subject}:${action}`
        if (!catalogue.has(key)) missing.push(`${key} (${path.relative(ROOT, file)})`)
      }
    }
    expect(missing).toEqual([])
  })

  it('every permission.<action>Any(subject) check has a permission row', () => {
    const template = templatePairs()
    const missing: string[] = []
    for (const file of walk(SRC)) {
      for (const [subject, action] of anyPairs(readFileSync(file, 'utf8'))) {
        const key = `${subject}:${action}`
        if (!catalogue.has(key) && !template.has(key)) {
          missing.push(`${key} (${path.relative(ROOT, file)})`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
