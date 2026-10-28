// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/providers/user', () => ({ GET_CUSTOMERS: vi.fn() }))

import { GET_CUSTOMERS } from '@/providers/user'
import requiredAuth from '@/utils/required-auth'
import { GET } from './route'

const makeAuth = (granted: boolean) => ({
  permission: { readAny: () => ({ granted }) },
})

describe('GET /api/v1/customers pagination security', () => {
  beforeEach(() => vi.clearAllMocks())

  it('caps page size without capping the page number before calling the provider', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)
    vi.mocked(GET_CUSTOMERS).mockResolvedValue({ result: [], total: 0 } as never)

    const response = await GET(
      new NextRequest('http://localhost/api/v1/customers?page=999999999999&limit=999999'),
    )

    expect(response?.status).toBe(200)
    expect(GET_CUSTOMERS).toHaveBeenCalledWith(
      expect.objectContaining({ page: 999999999999, limit: 100 }),
    )
  })

  it('rejects non-allowlisted sort fields', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(true) as never)

    const response = await GET(
      new NextRequest('http://localhost/api/v1/customers?order_by=password'),
    )

    expect(response?.status).toBe(400)
    expect((await response?.json()).error_code).toBe('INVALID_ORDER_BY')
    expect(GET_CUSTOMERS).not.toHaveBeenCalled()
  })

  it('authorizes before disclosing query validation details', async () => {
    vi.mocked(requiredAuth).mockResolvedValue(makeAuth(false) as never)

    const response = await GET(
      new NextRequest('http://localhost/api/v1/customers?order_by=password'),
    )

    expect(response?.status).toBe(403)
    expect((await response?.json()).error_code).toBe('NOT_ALLOWED')
  })
})
