import { describe, expect, it, vi } from 'vitest'
import { SITE_NAME, SITE_URL } from '@/config/site-brand'
import manifest from './manifest'
import robots from './robots'
import sitemap from './sitemap'

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

    expect(urls.slice(0, 3)).toEqual([
      `${SITE_URL}/welcome`,
      `${SITE_URL}/churches`,
      `${SITE_URL}/privacy`,
    ])
    expect(urls.some((url) => url.includes('/terms'))).toBe(false)
    expect(urls.some((url) => url.includes('/cookies'))).toBe(false)
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
