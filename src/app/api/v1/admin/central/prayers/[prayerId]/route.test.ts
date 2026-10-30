// @vitest-environment node
import { GeneralError } from '@/utils/general-error'
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCentralPrayer: vi.fn(),
  requiredAuth: vi.fn(),
  requiredScope: vi.fn(),
}))

vi.mock('@/controller/prayer', () => ({ getCentralPrayer: mocks.getCentralPrayer }))
vi.mock('@/utils/required-auth', () => ({ default: mocks.requiredAuth }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: mocks.requiredScope }))

import { GET } from './route'

const request = new NextRequest('http://localhost/api/v1/admin/central/prayers/prayer-1')
const context = { params: Promise.resolve({ prayerId: 'prayer-1' }) }

describe('GET /api/v1/admin/central/prayers/:prayerId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'user-1' } } })
    mocks.requiredScope.mockResolvedValue({ churchIds: new Set(['church-1']) })
    mocks.getCentralPrayer.mockResolvedValue({
      id: 'prayer-1',
      churchId: 'church-1',
      churchName: 'Authorized Church',
    })
  })

  it('returns a prayer only from the caller central church scope', async () => {
    const response = await GET(request, context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result.churchName).toBe('Authorized Church')
    expect(mocks.requiredScope).toHaveBeenCalledWith({
      userId: 'user-1',
      central: true,
      subject: 'prayer_prayer',
      action: 'read',
    })
    expect(mocks.getCentralPrayer).toHaveBeenCalledWith({
      churchIds: new Set(['church-1']),
      prayerId: 'prayer-1',
    })
  })

  it('does not query the prayer when central scope is denied', async () => {
    mocks.requiredScope.mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Not allowed.',
      }),
    )

    const response = await GET(request, context)

    expect(response.status).toBe(403)
    expect(mocks.getCentralPrayer).not.toHaveBeenCalled()
  })
})
