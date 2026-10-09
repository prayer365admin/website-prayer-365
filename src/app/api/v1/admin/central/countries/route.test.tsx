// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/registry', () => ({
  createCountry: vi.fn(),
  listCountries: vi.fn(),
  createLanguage: vi.fn(),
  listLanguages: vi.fn(),
}))

import { listCountries, listLanguages } from '@/controller/registry'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { GET as GetLanguages } from '../languages/route'
import { GET as GetCountries } from './route'

describe('GET registry lists without order_by (as the dashboard calls them)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue({ session: { user: { user_id: 'admin' } } } as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
    vi.mocked(listCountries).mockResolvedValue({ total: 0, result: [] } as never)
    vi.mocked(listLanguages).mockResolvedValue({ total: 0, result: [] } as never)
  })

  it('returns 200 for countries', async () => {
    const res = (await GetCountries(
      new NextRequest(
        'http://localhost/api/v1/admin/central/countries?page=1&limit=100&order_direction=asc',
      ),
    ))!
    expect(res.status).toBe(200)
  })

  it('returns 200 for languages', async () => {
    const res = (await GetLanguages(
      new NextRequest(
        'http://localhost/api/v1/admin/central/languages?page=1&limit=100&order_direction=asc',
      ),
    ))!
    expect(res.status).toBe(200)
  })
})
