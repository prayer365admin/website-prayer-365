import { describe, expect, it, vi } from 'vitest'
import { SITE_NAME, SITE_URL } from '@/config/site-brand'
import manifest from './manifest'
import robots from './robots'
import sitemap from './sitemap'

vi.mock('@/controller/mobile', () => ({
  listPublicChurches: vi.fn().mockResolvedValue({ result: [{ slug: 'grace-church' }] }),
}))
// The sitemap also lists the platform daily prayer (GP-SITE-05); without this
// mock the real controller runs, throws without a DB, and the catch in
// `sitemap()` silently drops the church URLs too.
vi.mock('@/controller/general-prayer', () => ({
  listGeneralPrayerCycle: vi.fn().mockResolvedValue({
    cycle: [{ slug: 'paivapalve-1' }, { slug: 'paivapalve-2' }],
    todaySequence: 1,
  }),
}))
vi.mock('next/font/google', () => ({
  Manrope: () => ({ variable: '--font-heading' }),
  Instrument_Serif: () => ({ variable: '--font-quote' }),
}))
vi.mock('@/components/container/global-provider', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

describe('brand metadata', () => {
  it('sitemap lists the public pages and every approved church', async () => {
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls.slice(0, 2)).toEqual([`${SITE_URL}/welcome`, `${SITE_URL}/privacy`])
    // The church directory needs a session, so it is not a public URL.
    expect(urls).not.toContain(`${SITE_URL}/churches`)
    expect(urls).toContain(`${SITE_URL}/churches/grace-church`)
    expect(urls.some((url) => url.includes('/terms'))).toBe(false)
    expect(urls.some((url) => url.includes('/cookies'))).toBe(false)
    // The platform daily prayer cycle index and every active position.
    expect(urls).toContain(`${SITE_URL}/prayers/general`)
    expect(urls).toContain(`${SITE_URL}/prayers/general/paivapalve-1`)
  })

  it('robots allows the public pages and disallows the app', () => {
    const result = robots()
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules

    expect(rule?.allow).toEqual(['/', '/welcome', '/churches', '/privacy'])
    expect(rule?.disallow).toContain('/dashboard')
    expect(rule?.disallow).toContain('/api')
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })

  it('manifest carries the product name and both icons', () => {
    const result = manifest()

    expect(result.short_name).toBe(SITE_NAME)
    expect(result.icons?.map((icon) => icon.src)).toEqual([
      '/icons/app/icon-192.png',
      '/icons/app/icon-512.png',
    ])
  })

  it('never falls back to the template brand', async () => {
    const root = await import('./layout')
    const serialized = JSON.stringify(root.metadata)

    expect(serialized).not.toContain('Catalyst Inertia')
    expect(serialized).toContain(SITE_NAME)
    expect(root.metadata.robots).toMatchObject({ index: false, follow: false })
  })
})
