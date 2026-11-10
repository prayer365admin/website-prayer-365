import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  aliasSlugFor,
  buildChurchPlans,
  cityFor,
  groupPastors,
  normaliseName,
  parseRows,
} from './rules'

const rows = parseRows(
  JSON.parse(readFileSync('prisma/import/church-directory.json', 'utf8')) as Record<
    string,
    string
  >[],
)

describe('church directory rules', () => {
  it('parses all 25 CSV rows', () => {
    expect(rows).toHaveLength(25)
  })

  it('normalises curly apostrophes so CSV names match PROD names', () => {
    expect(normaliseName('Viimsi St James’ Church')).toBe("viimsi st james' church")
    expect(normaliseName("Viimsi St James' Church")).toBe("viimsi st james' church")
  })

  it('treats "St." and "St" as the same name, so PROD churches are updated not duplicated', () => {
    expect(normaliseName('Karuse St. Margaret’s Church')).toBe(
      normaliseName('Karuse St Margaret’s Church'),
    )
  })

  it('maps the 6 existing churches: 5 by name, 1 by alias', () => {
    expect(aliasSlugFor('Viimsi St James’ Church')).toBeNull()
    expect(aliasSlugFor('Tallinn Kaarli Church')).toBe('kaarli-kirik-st-charless-church')
  })

  it('gives every row a city', () => {
    expect(cityFor('1')).toBe('Haabneeme')
    expect(cityFor('21')).toBe('Kaarma-Kirikuküla')
    for (const row of rows) expect(cityFor(row.directory_order)).toBeTruthy()
  })

  it('groups 25 rows into 23 unique pastors and keeps both churches for a shared pastor', () => {
    const pastors = groupPastors(rows)
    expect(pastors).toHaveLength(23)
    const jaak = pastors.find((pastor) => pastor.email === 'jaak.aus@kaarlikogudus.ee')
    expect(jaak?.assignments).toHaveLength(2)
  })

  it('never carries the masked phone number into a payload', () => {
    const plans = buildChurchPlans(rows, {})
    for (const plan of plans) expect(JSON.stringify(plan)).not.toContain('****')
  })

  it('writes lat/lng only when both coordinates are supplied', () => {
    const plans = buildChurchPlans(rows, { '1': { lat: 59.52, lng: 24.8 } })
    expect(plans[0].latitude).toBe(59.52)
    expect(plans[1].latitude).toBeNull()
  })

  it('asks for et only, and one church image per row', () => {
    const plans = buildChurchPlans(rows, {})
    for (const plan of plans) {
      expect(plan.languages).toEqual(['et'])
      expect(plan.churchImage.url).toMatch(/^https:\/\//)
      expect(plan.churchImage.sourceUrl).toMatch(/^https:\/\//)
    }
  })
})
