import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ listChurchOptions: vi.fn(), listFrequentChurches: vi.fn() }))

vi.mock('@/controller/church-option', () => m)

import { GET as search } from './route'
import { GET as frequent } from './frequent/route'

const option = { id: 'c1', slug: 'tallinna-jaani', name: 'Tallinna Jaani', city: 'Tallinn' }

describe('public church picker routes (WB1, no session)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /public/churches passes the search and returns options without a session', async () => {
    m.listChurchOptions.mockResolvedValue([option])

    const res = await search(
      new NextRequest('http://localhost/api/v1/public/churches?search=jaani'),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.result).toEqual([option])
    expect(m.listChurchOptions).toHaveBeenCalledWith({ query: { search: 'jaani' } })
  })

  it('GET /public/churches rejects an oversized search with 422', async () => {
    const res = await search(
      new NextRequest(`http://localhost/api/v1/public/churches?search=${'a'.repeat(101)}`),
    )

    expect(res.status).toBe(422)
    expect(m.listChurchOptions).not.toHaveBeenCalled()
  })

  it('GET /public/churches/frequent is CDN-cacheable for an hour', async () => {
    m.listFrequentChurches.mockResolvedValue([option])

    const res = await frequent()

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=3600')
    expect((await res.json()).result).toEqual([option])
  })
})
