// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/controller/role-assignment', () => ({
  createRoleAssignment: vi.fn(),
  listRoleAssignments: vi.fn(),
  revokeRoleAssignment: vi.fn(),
}))

import { GeneralError } from '@/utils/general-error'
import {
  createRoleAssignment,
  listRoleAssignments,
  revokeRoleAssignment,
} from '@/controller/role-assignment'
import requiredAuth from '@/utils/required-auth'
import { requiredScope } from '@/utils/required-scope'
import { DELETE as DeleteAssignment } from './[assignmentId]/route'
import { GET, POST } from './route'

const auth = { session: { user: { user_id: 'actor' } } }

describe('GET /api/v1/admin/central/role-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('returns 200 with the list envelope and request_id', async () => {
    vi.mocked(listRoleAssignments).mockResolvedValue({ total: 1, result: [{ id: 'a1' }] } as never)
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/central/role-assignments'),
    ))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, total: 1 })
    expect(body.request_id).toBeTruthy()
  })

  it('enforces permission — 403 when the central scope is denied', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )
    const res = (await GET(
      new NextRequest('http://localhost/api/v1/admin/central/role-assignments'),
    ))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('NOT_ALLOWED')
  })
})

describe('POST /api/v1/admin/central/role-assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('creates an assignment and returns 201', async () => {
    vi.mocked(createRoleAssignment).mockResolvedValue({ id: 'a1' } as never)
    const req = new NextRequest('http://localhost/api/v1/admin/central/role-assignments', {
      method: 'POST',
      body: JSON.stringify({ userId: 'u1', roleKey: 'prayer_church_admin', orgNodeId: 'n1' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ success: true, message: 'Role assignment created' })
  })

  it('returns 422 on an invalid body', async () => {
    const req = new NextRequest('http://localhost/api/v1/admin/central/role-assignments', {
      method: 'POST',
      body: JSON.stringify({ roleKey: '' }),
    })
    const res = (await POST(req!))!
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/v1/admin/central/role-assignments/:assignmentId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requiredAuth).mockResolvedValue(auth as never)
    vi.mocked(requiredScope).mockResolvedValue({} as never)
  })

  it('revokes via the controller (soft delete) and returns 200', async () => {
    vi.mocked(revokeRoleAssignment).mockResolvedValue({
      id: 'a1',
      revoked_at: '2026-02-01T00:00:00.000Z',
    } as never)
    const req = new NextRequest('http://localhost/api/v1/admin/central/role-assignments/a1', {
      method: 'DELETE',
    })
    const res = (await DeleteAssignment(req!, { params: Promise.resolve({ assignmentId: 'a1' }) }))!
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.revoked_at).not.toBeNull()
  })

  it('enforces permission — 403 when denylest', async () => {
    vi.mocked(requiredScope).mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'denied',
      }),
    )
    const req = new NextRequest('http://localhost/api/v1/admin/central/role-assignments/a1', {
      method: 'DELETE',
    })
    const res = (await DeleteAssignment(req!, { params: Promise.resolve({ assignmentId: 'a1' }) }))!
    expect(res.status).toBe(403)
  })
})
