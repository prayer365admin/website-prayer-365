import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Craft guard for colour and radius discipline.
 *
 * Two kinds of check, because the repo is not clean yet:
 *  1. The screens this release owns must carry no literal colour at all.
 *  2. Everywhere else is ratcheted: the repo-wide counts may not grow. Fixing a file lowers a
 *     ceiling by hand in the same change — a ceiling is a debt ledger, not a permission.
 *
 * A literal hex, a raw Tailwind palette class and an inline numeric radius all escape the theme,
 * so all three are counted. Comments are skipped: they document values instead of shipping them.
 */

const SRC = 'src'

/** Screens and primitives that must hold zero literal colours (the release-owned surface). */
const STRICT_FILES = [
  'src/contents/dashboard/donations/index.tsx',
  'src/contents/dashboard/donations/columns.tsx',
  'src/contents/churches/donations/index.tsx',
  'src/contents/churches/donations/columns.tsx',
  'src/contents/churches/donations/status-pill.tsx',
  'src/contents/churches/donations/status-filter.tsx',
  'src/contents/churches/donations/donation-detail-modal.tsx',
  'src/contents/customer/columns.tsx',
  'src/contents/site/welcome/coming-soon.tsx',
]

/** The one source allowed to name colours outside the theme: drawn brand art. */
const COLOUR_MODULES = ['src/components/icon/']

/**
 * Repo-wide ceilings, measured 2026-11-20 before the release tokens were moved out of the new
 * screens. Lower a number when a file gets cleaned; never raise one — raise the reviewer's
 * attention instead.
 */
const CEILINGS = { hex: 1514, palette: 70, radius: 19 }

const HEX = /#[0-9A-Fa-f]{6}/g
const RGBA = /rgba?\(/g
/**
 * Raw Tailwind palette families. `primary`, `neutral`, `blue`, `gray`, `danger`, `warning` and
 * `success` are project tokens (they map to `--color-*` in tailwind.config.ts), so they are not
 * listed here; every other family is a second palette nobody chose.
 */
const PALETTE =
  /(bg|text|border|from|to|ring|fill|stroke)-(slate|zinc|stone|red|green|amber|indigo|purple|pink|rose|teal|cyan|emerald|sky|violet|fuchsia|lime|orange)-\d{2,3}/g
const RADIUS = /borderRadius:\s*\d+/g

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(tsx|ts)$/.test(path) && !/\.test\./.test(path)) out.push(path)
  }
  return out
}

const isComment = (line: string) => /^\s*(\/\/|\*|\/\*|<!--)/.test(line)
const countMatches = (text: string, regex: RegExp) => (text.match(regex) ?? []).length

const sourceFiles = walk(SRC)

describe('craft guard', () => {
  it('the release screens carry no literal colour', () => {
    const offenders: string[] = []
    for (const file of STRICT_FILES) {
      const text = readFileSync(file, 'utf8')
      text.split('\n').forEach((line, index) => {
        if (isComment(line)) return
        if (HEX.test(line) || RGBA.test(line)) offenders.push(`${file}:${index + 1}`)
        HEX.lastIndex = 0
        RGBA.lastIndex = 0
      })
    }
    expect(offenders).toEqual([])
  })

  it('the release screens carry no raw palette class', () => {
    const offenders: string[] = []
    for (const file of STRICT_FILES) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (isComment(line)) return
          if (PALETTE.test(line)) offenders.push(`${file}:${index + 1}`)
          PALETTE.lastIndex = 0
        })
    }
    expect(offenders).toEqual([])
  })

  it('the repo-wide literal-colour count only goes down', () => {
    let hex = 0
    let palette = 0
    let radius = 0
    const perFile: string[] = []
    for (const file of sourceFiles) {
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n').filter((line) => !isComment(line))
      const fileHex = lines.reduce((sum, line) => sum + countMatches(line, HEX), 0)
      const filePalette = lines.reduce((sum, line) => sum + countMatches(line, PALETTE), 0)
      const fileRadius = countMatches(text, RADIUS)
      if (fileHex + filePalette + fileRadius > 0) {
        perFile.push(`${file}: hex ${fileHex}, palette ${filePalette}, radius ${fileRadius}`)
      }
      hex += fileHex
      palette += filePalette
      radius += fileRadius
    }
    const report = `hex ${hex}/${CEILINGS.hex} · palette ${palette}/${CEILINGS.palette} · radius ${radius}/${CEILINGS.radius}\n${perFile.join('\n')}`
    expect(hex, report).toBeLessThanOrEqual(CEILINGS.hex)
    expect(palette, report).toBeLessThanOrEqual(CEILINGS.palette)
    expect(radius, report).toBeLessThanOrEqual(CEILINGS.radius)
  })

  it('the colour modules the guard exempts still exist', () => {
    for (const prefix of COLOUR_MODULES) {
      expect(sourceFiles.some((file) => file.startsWith(prefix))).toBe(true)
    }
  })
})
