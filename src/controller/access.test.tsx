import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/scope', () => ({
  RESOLVE_SCOPE_TARGET: vi.fn(),
  GET_USER_SCOPE_DATA: vi.fn(),
  scopeKind: (kind: string) => kind.toLowerCase(),
}))

import { getEffectiveAccess } from './access'
import { RESOLVE_SCOPE_TARGET, GET_USER_SCOPE_DATA } from '@/providers/scope'

const makeScopeData = () => ({
  assignments: [{ role_id: 'r1', role_name: 'prayer_church_admin', org_node_id: 'churchNode' }],
  roles: [
    {
      id: 'r1',
      name: 'prayer_church_admin',
      permission: [
        { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
        { subject: 'prayer_church', actions: 'update', scope: 'ANY' },
        { subject: 'prayer_prayer', actions: 'read', scope: 'ANY' },
      ],
    },
  ],
  ancestors: new Map([
    ['churchNode', ['churchNode']],
    ['region', ['region', 'churchNode']],
  ]),
  _orgNodes: [],
})

describe('getEffectiveAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns church-scoped effective subjects/actions', async () => {
    vi.mocked(RESOLVE_SCOPE_TARGET).mockResolvedValue({
      orgNodeId: 'churchNode',
      kind: 'CHURCH',
      name: 'St. Andrew',
    } as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue(makeScopeData() as never)

    const out = await getEffectiveAccess({
      userId: 'u1',
      churchId: 'church-1',
    })
    expect(out.scope).toEqual({ kind: 'church', orgNodeId: 'churchNode', name: 'St. Andrew' })
    expect(out.subjects).toEqual({
      prayer_church: ['read', 'update'],
      prayer_prayer: ['read'],
    })
  })

  it('resolves region scope via regionId', async () => {
    vi.mocked(RESOLVE_SCOPE_TARGET).mockResolvedValue({
      orgNodeId: 'region',
      kind: 'DIOCESE',
      name: 'Estonia',
    } as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue(makeScopeData() as never)

    const out = await getEffectiveAccess({ userId: 'u1', regionId: 'region' })
    expect(out.scope.kind).toBe('diocese')
  })

  it('throws 400 when both churchId and regionId given (mixed params)', async () => {
    await expect(
      getEffectiveAccess({ userId: 'u1', churchId: 'c1', regionId: 'r1' }),
    ).rejects.toMatchObject({ code: 400, error_code: 'SCOPE_AMBIGUOUS' })
  })

  it('throws 400 when neither param given', async () => {
    await expect(getEffectiveAccess({ userId: 'u1' })).rejects.toMatchObject({
      code: 400,
      error_code: 'SCOPE_AMBIGUOUS',
    })
  })

  it('throws 404 when scope target unknown', async () => {
    vi.mocked(RESOLVE_SCOPE_TARGET).mockResolvedValue(null as never)
    await expect(getEffectiveAccess({ userId: 'u1', churchId: 'nope' })).rejects.toMatchObject({
      code: 404,
      error_code: 'RESOURCE_NOT_FOUND',
    })
  })

  it('omits unauthorized actions (returns empty subjects) when no covering assignment', async () => {
    vi.mocked(RESOLVE_SCOPE_TARGET).mockResolvedValue({
      orgNodeId: 'other',
      kind: 'CHURCH',
      name: 'Other',
    } as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue({
      assignments: [{ role_id: 'r1', role_name: 'x', org_node_id: 'churchNode' }],
      roles: [],
      ancestors: new Map([['other', ['other']]]),
      _orgNodes: [],
    } as never)

    const out = await getEffectiveAccess({ userId: 'u1', churchId: 'c1' })
    expect(out.subjects).toEqual({})
  })

  it('does not grant prayer_private_request from an ancestor-level grant at church scope', async () => {
    vi.mocked(RESOLVE_SCOPE_TARGET).mockResolvedValue({
      orgNodeId: 'churchNode',
      kind: 'CHURCH',
      name: 'St. Andrew',
    } as never)
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue({
      assignments: [
        // global admin granted prayer_private_request at GLOBAL (ancestor) node
        { role_id: 'r1', role_name: 'prayer_global_admin', org_node_id: 'root' },
      ],
      roles: [
        {
          id: 'r1',
          name: 'prayer_global_admin',
          permission: [{ subject: 'prayer_private_request', actions: 'read', scope: 'ANY' }],
        },
      ],
      ancestors: new Map([
        ['root', ['root']],
        ['churchNode', ['churchNode', 'root']],
      ]),
      _orgNodes: [],
    } as never)

    const out = await getEffectiveAccess({ userId: 'u1', churchId: 'c1' })
    expect(out.subjects).toEqual({})
  })
})
