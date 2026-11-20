import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildSeedChurches } from './dataset'
import { parseDirectory } from './parse'

const rows = parseDirectory(readFileSync('.hermes/fixtures/eelk-seed/inc-kogudused.html', 'utf8'))
const churches = buildSeedChurches(rows, {})

describe('buildSeedChurches', () => {
  it('builds one record per row', () => {
    expect(churches).toHaveLength(170)
  })

  it('prefers the building address as line1', () => {
    const aegviidu = churches.find((church) => church.regCode === '80211219')
    expect(aegviidu?.address.line1).toBe('Mäe 3')
    expect(aegviidu?.address.city).toBe('Aegviidu')
  })

  it('attaches the existing slug only for a mapped reg code', () => {
    expect(churches.find((church) => church.regCode === '80209820')?.existingSlug).toBe(
      'viimsi-st-james-church',
    )
    expect(churches.find((church) => church.regCode === '80211219')?.existingSlug).toBeNull()
    expect(churches.filter((church) => church.existingSlug).length).toBe(23)
  })

  it('keeps a church without coordinates in the list instead of dropping it', () => {
    expect(churches.filter((church) => church.coordinates === null)).toHaveLength(170)
  })
})
