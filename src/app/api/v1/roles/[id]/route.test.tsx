import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  readRole: false,
  getRole: vi.fn(),
}))

vi.mock('@/utils/required-auth', () => ({
  default: async () => ({
    session: { user: { role: { id: 'own-role', name: 'prayer_church_admin' } } },
    permission: { readAny: () => ({ granted: m.readRole }) },
  }),
}))
vi.mock('@/providers/role', () => ({ GET_ROLE_BY_ID: m.getRole }))

import { GET } from './route'

const call = (id: string) => GET({} as never, { params: Promise.resolve({ id }) })

describe('GET /roles/:id', () => {
  beforeEach(() => {
    m.readRole = false
    m.getRole.mockReset().mockResolvedValue({ id: 'x', permission: [] })
  })

  it('lets an account read its own role without prayer_role', async () => {
    expect((await call('own-role')).status).toBe(200)
  })

  it('denies another role without prayer_role read', async () => {
    expect((await call('other-role')).status).toBe(403)
    expect(m.getRole).not.toHaveBeenCalled()
  })

  it('allows another role with prayer_role read', async () => {
    m.readRole = true
    expect((await call('other-role')).status).toBe(200)
  })
})
