import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDirectory } from './parse'

const html = readFileSync('.hermes/fixtures/eelk-seed/inc-kogudused.html', 'utf8')
const rows = parseDirectory(html)
const aegviidu = rows.find((row) => row.name === 'AEGVIIDU Aleksandri kogudus')

describe('parseDirectory', () => {
  it('reads one row per congregation', () => {
    expect(rows).toHaveLength(170)
  })

  it('keeps the praostkond out of the name', () => {
    expect(aegviidu?.deanery).toBe('Järva praostkond')
    expect(aegviidu?.name).not.toMatch(/praostkond/)
  })

  it('finds the reg code of every row', () => {
    expect(rows.every((row) => /^\d{8}$/.test(row.regCode))).toBe(true)
  })

  it('does not mistake the reg-code line for the address', () => {
    expect(aegviidu?.addressLine).toBe('Mäe 2, Aegviidu, Anija vald, 74501 Harjumaa')
  })

  it('keeps the building address separate', () => {
    expect(aegviidu?.churchAddressLine).toBe('kiriku aadress: Mäe 3')
  })

  it('takes the congregation email from the tel line', () => {
    expect(aegviidu?.email).toBe('aegviidu@eelk.ee')
  })

  it('gives a bare host a scheme', () => {
    const anna = rows.find((row) => row.name === 'ANNA kogudus')
    expect(anna?.website).toBe('https://anna.eelk.ee')
  })

  it('keeps facebook profiles and drops share links', () => {
    const withSocial = rows.filter((row) => row.socialLinks.length > 0)
    expect(withSocial).toHaveLength(125)
    expect(
      rows.every((row) => row.socialLinks.every((link) => !/sharer|plugins/.test(link.url))),
    ).toBe(true)
  })

  it('keeps the service sentence for 169 rows', () => {
    expect(rows.filter((row) => row.serviceSentence).length).toBe(169)
  })
})
