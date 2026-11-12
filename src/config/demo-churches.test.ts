import { readFileSync } from 'node:fs'
import customSlugify from '@/utils/slugify'
import { describe, expect, it } from 'vitest'
import { DEMO_CHURCH_NAMES, DEMO_CHURCH_SLUGS } from './demo-churches'

const seedSource = ['prisma/seeds/church.ts', 'prisma/seeds/test-context.ts']
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n')

describe('demo churches', () => {
  it('lists every demo name exactly once', () => {
    expect(new Set(DEMO_CHURCH_NAMES).size).toBe(DEMO_CHURCH_NAMES.length)
  })

  it('only lists names the seeds actually create', () => {
    for (const name of DEMO_CHURCH_NAMES) expect(seedSource).toContain(name)
  })

  it('derives the slug the seed derives', () => {
    expect(DEMO_CHURCH_SLUGS).toContain('st-johns-church')
    expect(DEMO_CHURCH_SLUGS).toContain('parnu-st-elizabeths-church')
    for (const slug of DEMO_CHURCH_SLUGS) {
      expect(customSlugify({ text: slug, isExists: false })).toBe(slug)
    }
  })
})
