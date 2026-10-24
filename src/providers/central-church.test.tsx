// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { churchOrgPath, OrgNodeRow } from './central-church'

const node = (overrides: Partial<OrgNodeRow> & { id: string }): OrgNodeRow => ({
  parent_id: null,
  kind: 'CHURCH',
  name: 'Node',
  country_code: null,
  ...overrides,
})

const tree = () =>
  new Map<string, OrgNodeRow>([
    ['global', node({ id: 'global', kind: 'GLOBAL', name: 'Global' })],
    [
      'co',
      node({ id: 'co', kind: 'COUNTRY', name: 'Estonia', country_code: 'EE', parent_id: 'global' }),
    ],
    ['di', node({ id: 'di', kind: 'DIOCESE', name: 'Tallinn Diocese', parent_id: 'co' })],
    ['de', node({ id: 'de', kind: 'DEANERY', name: 'Harju Deanery', parent_id: 'di' })],
    ['ch-node', node({ id: 'ch-node', kind: 'CHURCH', name: 'Example Church', parent_id: 'de' })],
  ])

describe('churchOrgPath', () => {
  it('returns country and the diocese/deanery chain, outermost first', () => {
    expect(churchOrgPath(tree(), 'ch-node')).toEqual({
      country: 'Estonia',
      countryCode: 'EE',
      organization: ['Tallinn Diocese', 'Harju Deanery'],
    })
  })

  it('returns empty labels for a church node that is not placed yet', () => {
    const nodes = new Map<string, OrgNodeRow>([
      ['lonely', node({ id: 'lonely', kind: 'CHURCH', name: 'Unplaced' })],
    ])
    expect(churchOrgPath(nodes, 'lonely')).toEqual({
      country: null,
      countryCode: null,
      organization: [],
    })
  })

  it('survives a chain with a missing ancestor instead of looping', () => {
    const nodes = new Map<string, OrgNodeRow>([
      ['de', node({ id: 'de', kind: 'DEANERY', name: 'Harju Deanery', parent_id: 'gone' })],
      ['ch-node', node({ id: 'ch-node', kind: 'CHURCH', name: 'Example', parent_id: 'de' })],
    ])
    expect(churchOrgPath(nodes, 'ch-node')).toEqual({
      country: null,
      countryCode: null,
      organization: ['Harju Deanery'],
    })
  })
})
