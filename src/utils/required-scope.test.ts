import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requiredScope } from './required-scope'
import { ResolvedUserScope, ScopeRequest } from '@/models/scope'
import { PRAYER_ROLES } from '../../prisma/seeds/prayer-roles'

const church = { org_node_id: 'node-church-a' }
void church
const root = { id: 'node-global' }

const GLOBAL = { id: 'node-global', parent_id: null, kind: 'GLOBAL' }
const COUNTRY = { id: 'node-country', parent_id: 'node-global', kind: 'COUNTRY' }
const DIOCESE = { id: 'node-diocese', parent_id: 'node-country', kind: 'DIOCESE' }
const CHURCH_A = { id: 'node-church-a', parent_id: 'node-diocese', kind: 'CHURCH' }
const CHURCH_B = { id: 'node-church-b', parent_id: 'node-diocese', kind: 'CHURCH' }

const role = (
  name: string,
  grants: Array<{ subject: string; actions: string; scope: 'ANY' | 'OWN' }>,
) => ({
  id: `role-${name}`,
  name,
  type: 'USER' as const,
  version: 1,
  permission: grants.flatMap((g) =>
    g.actions.split(',').map((a) => ({
      id: `perm-${g.subject}-${a}-${g.scope}`,
      subject: g.subject,
      actions: a,
      scope: g.scope,
    })),
  ),
})

const scopeData = (overrides: Partial<ResolvedUserScope> = {}): ResolvedUserScope => ({
  assignments: [],
  roles: [],
  ancestors: new Map([
    [CHURCH_A.id, [CHURCH_A.id, DIOCESE.id, COUNTRY.id, GLOBAL.id]],
    [CHURCH_B.id, [CHURCH_B.id, DIOCESE.id, COUNTRY.id, GLOBAL.id]],
    [DIOCESE.id, [DIOCESE.id, COUNTRY.id, GLOBAL.id]],
    [COUNTRY.id, [COUNTRY.id, GLOBAL.id]],
    [GLOBAL.id, [GLOBAL.id]],
  ]),
  _orgNodes: [GLOBAL, COUNTRY, DIOCESE, CHURCH_A, CHURCH_B],
  ...overrides,
})

let mockScopeData: ResolvedUserScope

vi.mock('@/providers/scope', () => ({
  GET_USER_SCOPE_DATA: vi.fn(() => ({
    ...mockScopeData,
    roles: mockScopeData.assignments.map((a) => (a as unknown as { role: unknown }).role),
  })),
}))

vi.mock('@/utils/db-connection', () => ({
  db: {
    church: {
      findUnique: vi.fn(
        ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
          const churchToOrg: Record<string, string> = {
            'church-a': 'node-church-a',
            'church-b': 'node-church-b',
          }
          const org = churchToOrg[where.id]
          if (!org) return null
          return select ? { org_node_id: org } : { id: where.id, org_node_id: org }
        },
      ),
      findMany: vi.fn(({ where }: { where: { org_node_id: { in: string[] } } }) =>
        where.org_node_id.in
          .filter((n: string) => orgToMap[n])
          .map((n: string) => ({ id: orgToMap[n] })),
      ),
    },
    orgNode: { findFirst: vi.fn(() => root) },
  },
}))

let orgToMap: Record<string, string> = { 'node-church-a': 'church-a', 'node-church-b': 'church-b' }

const grant = (
  roleName: string,
  orgNodeId: string,
  grants: Array<{ subject: string; actions: string; scope: 'ANY' | 'OWN' }>,
) => ({
  role_id: `role-${roleName}`,
  role_name: roleName,
  org_node_id: orgNodeId,
  role: role(roleName, grants),
})

const seededGrant = (roleName: string, orgNodeId: string) => {
  const seededRole = PRAYER_ROLES.find(({ name }) => name === roleName)
  if (!seededRole) throw new Error(`Missing seeded role: ${roleName}`)
  return grant(roleName, orgNodeId, seededRole.grants)
}

beforeEach(() => {
  vi.clearAllMocks()
  orgToMap = { 'node-church-a': 'church-a', 'node-church-b': 'church-b' }
  mockScopeData = scopeData()
})

const call = (req: Partial<ScopeRequest>) => requiredScope({ userId: 'u1', ...req } as ScopeRequest)

describe('requiredScope', () => {
  it('rejects mixed scope params', async () => {
    await expect(
      call({ churchId: 'church-a', central: true, subject: 'prayer_church', action: 'read' }),
    ).rejects.toMatchObject({ code: 400 })
  })

  it('treats unknown church as 404 (hide existence)', async () => {
    await expect(
      call({ churchId: 'no-such', subject: 'prayer_church', action: 'read' }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('returns the single church for a church admin assignment', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_church_admin', CHURCH_A.id, [
          { subject: 'prayer_prayer', actions: 'read,create,update', scope: 'ANY' },
        ]),
      ],
    })
    const r = await call({ churchId: 'church-a', subject: 'prayer_prayer', action: 'read' })
    expect(r.churchIds).toEqual(new Set(['church-a']))
    expect(r.scope.kind).toBe('church')
  })

  it('denies 403 when action not granted', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_church_admin', CHURCH_A.id, [
          { subject: 'prayer_prayer', actions: 'read', scope: 'ANY' },
        ]),
      ],
    })
    await expect(
      call({ churchId: 'church-a', subject: 'prayer_event', action: 'create' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('denies when assignment node is out of scope for the target', async () => {
    // admin of church A tries church B
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_church_admin', CHURCH_A.id, [
          { subject: 'prayer_prayer', actions: 'read', scope: 'ANY' },
        ]),
      ],
    })
    await expect(
      call({ churchId: 'church-b', subject: 'prayer_prayer', action: 'read' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('region scope resolves descendant churches', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_country_admin', COUNTRY.id, [
          { subject: 'prayer_analytics', actions: 'read', scope: 'ANY' },
        ]),
      ],
    })
    const r = await call({ regionId: 'node-country', subject: 'prayer_analytics', action: 'read' })
    expect(r.churchIds).toEqual(new Set(['church-a', 'church-b']))
    expect(r.scope.kind).toBe('country')
  })

  it('denies private request via ancestor grant (needs church-local grant)', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_global_admin', GLOBAL.id, [
          { subject: 'prayer_private_request', actions: 'read', scope: 'ANY' },
        ]),
      ],
    })
    await expect(
      call({
        churchId: 'church-a',
        subject: 'prayer_private_request',
        action: 'read',
        churchLocalGrant: true,
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('allows private request with a church-local grant', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_private_request_reader', CHURCH_A.id, [
          { subject: 'prayer_private_request', actions: 'read', scope: 'ANY' },
        ]),
      ],
    })
    const r = await call({
      churchId: 'church-a',
      subject: 'prayer_private_request',
      action: 'read',
      churchLocalGrant: true,
    })
    expect(r.churchIds).toEqual(new Set(['church-a']))
  })

  it('fails closed when no active assignments', async () => {
    mockScopeData = scopeData({ assignments: [], roles: [] })
    await expect(
      call({ central: true, subject: 'prayer_church', action: 'create' }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('resolves central scope to global root for a global admin', async () => {
    mockScopeData = scopeData({
      assignments: [
        grant('prayer_global_admin', GLOBAL.id, [
          { subject: 'prayer_church', actions: 'read,create,update', scope: 'ANY' },
        ]),
      ],
    })
    const r = await call({ central: true, subject: 'prayer_church', action: 'read' })
    expect(r.scope.kind).toBe('global')
    expect(r.churchIds.size).toBeGreaterThan(0)
  })

  it.each(['read', 'create', 'update', 'delete'] as const)(
    'allows the seeded global admin to %s central pastor profiles',
    async (action) => {
      mockScopeData = scopeData({
        assignments: [seededGrant('prayer_global_admin', GLOBAL.id)],
      })

      const result = await call({
        central: true,
        subject: 'prayer_pastor',
        action,
      })

      expect(result.scope.kind).toBe('global')
      expect(result.churchIds).toEqual(new Set(['church-a', 'church-b']))
    },
  )

  it('allows the seeded church admin only within the assigned church', async () => {
    mockScopeData = scopeData({
      assignments: [seededGrant('prayer_church_admin', CHURCH_A.id)],
    })

    await expect(
      call({ churchId: 'church-a', subject: 'prayer_pastor', action: 'update' }),
    ).resolves.toMatchObject({ churchIds: new Set(['church-a']) })
    await expect(
      call({ churchId: 'church-b', subject: 'prayer_pastor', action: 'update' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_ALLOWED' })
    await expect(
      call({ central: true, subject: 'prayer_pastor', action: 'read' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_ALLOWED' })
  })

  it('does not derive pastor administration access from a linked identity', async () => {
    // A Pastor.user_id link is deliberately absent from scope data. With no
    // active RoleAssignment, the linked user fails closed.
    mockScopeData = scopeData({ assignments: [], roles: [] })

    await expect(
      call({ churchId: 'church-a', subject: 'prayer_pastor', action: 'read' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_ALLOWED' })
    await expect(
      call({ central: true, subject: 'prayer_pastor', action: 'update' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_ALLOWED' })
  })

  it('does not give the seeded pastor role permission to administer pastor profiles', async () => {
    mockScopeData = scopeData({
      assignments: [seededGrant('prayer_pastor', CHURCH_A.id)],
    })

    await expect(
      call({ churchId: 'church-a', subject: 'prayer_pastor', action: 'update' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'NOT_ALLOWED' })
  })
})
