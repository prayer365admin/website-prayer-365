import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

vi.mock('@/providers/scope', () => ({ GET_USER_SCOPE_DATA: vi.fn() }))
vi.mock('@/utils/required-scope', () => ({ requiredScope: vi.fn() }))
vi.mock('@/utils/db-connection', () => ({ db: { church: { findMany: vi.fn() } } }))
vi.mock('@/providers/church', () => ({
  GET_AVAILABLE_LANGUAGE_CODES: vi.fn(),
  GET_CHURCHES: vi.fn(),
  GET_CHURCH_OVERVIEW: vi.fn(),
  GET_CHURCH_PROFILE: vi.fn(),
  GET_CHURCH_VERSION: vi.fn(),
  GET_CHURCH_READY_IMAGE: vi.fn(),
  GET_REQUEST_OVERVIEW: vi.fn(),
  UPDATE_CHURCH_PROFILE: vi.fn(),
}))

import { GET_USER_SCOPE_DATA } from '@/providers/scope'
import { requiredScope } from '@/utils/required-scope'
import { db } from '@/utils/db-connection'
import {
  GET_AVAILABLE_LANGUAGE_CODES,
  GET_CHURCHES,
  GET_CHURCH_OVERVIEW,
  GET_CHURCH_PROFILE,
  GET_CHURCH_VERSION,
  GET_CHURCH_READY_IMAGE,
  GET_REQUEST_OVERVIEW,
  UPDATE_CHURCH_PROFILE,
} from '@/providers/church'
import { listChurches, getChurchOverview, getChurchProfile, patchChurchProfile } from './church'

const grantRole = (
  name: string,
  grants: Array<{ subject: string; actions: string; scope: 'ANY' | 'OWN' }>,
) => ({
  id: `role-${name}`,
  name,
  type: 'USER' as const,
  version: 1,
  permission: grants.flatMap((g) =>
    g.actions
      .split(',')
      .map((a) => ({ id: `p-${g.subject}-${a}`, subject: g.subject, actions: a, scope: g.scope })),
  ),
})

const scopeData = (
  assignments: Array<{
    role_name: string
    org_node_id: string
    role: ReturnType<typeof grantRole>
  }>,
) => ({
  assignments: assignments.map((a) => ({
    role_id: `role-${a.role_name}`,
    role_name: a.role_name,
    org_node_id: a.org_node_id,
    role: a.role,
  })),
  roles: assignments.map((a) => a.role),
  ancestors: new Map<string, string[]>(),
  _orgNodes: [
    { id: 'n-global', parent_id: null, kind: 'GLOBAL' },
    { id: 'n-church-a', parent_id: 'n-global', kind: 'CHURCH' },
    { id: 'n-church-b', parent_id: 'n-global', kind: 'CHURCH' },
  ],
})

const profile = { id: 'c1', name: 'A', version: 3 }
const input = {
  version: 3,
  name: 'A2',
  description: null,
  denomination: null,
  address: { line1: '1', city: 'X', countryCode: 'ID' },
  coordinates: null,
  timezone: 'UTC',
  contacts: {},
  website: null,
  socialLinks: [],
  languageCodes: ['en'],
  coverAssetId: null,
}

beforeEach(() => vi.resetAllMocks())

describe('listChurches', () => {
  it('returns the assigned churches resolved from scope', async () => {
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue(
      scopeData([
        {
          role_name: 'church_admin',
          org_node_id: 'n-church-a',
          role: grantRole('church_admin', [
            { subject: 'prayer_church', actions: 'read', scope: 'ANY' },
          ]),
        },
      ]) as never,
    )
    vi.mocked(db.church.findMany).mockResolvedValue([{ id: 'c-a' }] as never)
    vi.mocked(GET_CHURCHES).mockResolvedValue({ result: [{ id: 'c-a' }], total: 1 } as never)

    const res = await listChurches({
      userId: 'u1',
      query: { page: 1, limit: 25, order_by: 'name', order_direction: 'asc' },
    })
    expect(res.total).toBe(1)
    expect(GET_CHURCHES).toHaveBeenCalledWith(
      expect.objectContaining({ churchIds: new Set(['c-a']) }),
    )
  })

  it('returns empty when scope resolves no churches', async () => {
    vi.mocked(GET_USER_SCOPE_DATA).mockResolvedValue(scopeData([]) as never)
    const res = await listChurches({
      userId: 'u1',
      query: { page: 1, limit: 25, order_by: 'name', order_direction: 'asc' },
    })
    expect(res).toEqual({ result: [], total: 0 })
  })
})

describe('getChurchOverview', () => {
  const makeOverview = () => ({
    church: { id: 'c1', name: 'A', status: 'APPROVED', timezone: 'UTC', city: 'X', version: 3 },
    aggregates: {
      serviceTimeCount: 1,
      pastorCount: 0,
      prayerCount: 2,
      eventCount: 0,
      announcementDraftCount: 0,
      announcementPublishedCount: 0,
      memberCount: 0,
      mediaCount: 0,
    },
  })

  it('includes request section when request access is granted', async () => {
    vi.mocked(GET_CHURCH_OVERVIEW).mockResolvedValue(makeOverview() as never)
    vi.mocked(requiredScope).mockResolvedValue({
      userId: 'u1',
      churchIds: new Set(['c1']),
      scope: { kind: 'church', orgNodeId: 'n', name: '' },
    } as never)
    vi.mocked(GET_REQUEST_OVERVIEW).mockResolvedValue({ total: 5, recent: [] } as never)

    const res = await getChurchOverview({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
    })
    expect(res.requests).toEqual({ total: 5, recent: [] })
    expect(GET_REQUEST_OVERVIEW).toHaveBeenCalledWith({
      churchId: 'c1',
      canReadPrivate: true,
      take: 5,
    })
  })

  it('counts only visible requests when the caller lacks the private grant', async () => {
    vi.mocked(GET_CHURCH_OVERVIEW).mockResolvedValue(makeOverview() as never)
    vi.mocked(requiredScope).mockImplementation((async ({ subject }: { subject: string }) => {
      if (subject === 'prayer_private_request')
        throw new GeneralError({
          code: 403,
          error: 'UNAUTHORIZED',
          error_code: 'NOT_ALLOWED',
          details: 'No.',
        })
      return { userId: 'u1', churchIds: new Set(['c1']), scope: {} }
    }) as never)
    vi.mocked(GET_REQUEST_OVERVIEW).mockResolvedValue({ total: 1, recent: [] } as never)

    await getChurchOverview({ userId: 'u1', churchId: 'c1', churchIds: new Set(['c1']) })
    expect(GET_REQUEST_OVERVIEW).toHaveBeenCalledWith({
      churchId: 'c1',
      canReadPrivate: false,
      take: 5,
    })
  })

  it('OMITS request counts entirely when the caller lacks request access', async () => {
    vi.mocked(GET_CHURCH_OVERVIEW).mockResolvedValue(makeOverview() as never)
    vi.mocked(requiredScope).mockImplementation(() => {
      throw new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'No.',
      })
    })

    const res = await getChurchOverview({
      userId: 'u1',
      churchId: 'c1',
      churchIds: new Set(['c1']),
    })
    expect(res.requests).toBeUndefined()
    expect(GET_REQUEST_OVERVIEW).not.toHaveBeenCalled()
  })

  it('throws 404 when the church is out of scope', async () => {
    vi.mocked(GET_CHURCH_OVERVIEW).mockResolvedValue(null as never)
    await expect(
      getChurchOverview({ userId: 'u1', churchId: 'c9', churchIds: new Set(['c1']) }),
    ).rejects.toMatchObject({ code: 404 })
  })
})

describe('getChurchProfile', () => {
  it('returns the profile', async () => {
    vi.mocked(GET_CHURCH_PROFILE).mockResolvedValue(profile as never)
    await expect(getChurchProfile({ churchId: 'c1', churchIds: new Set(['c1']) })).resolves.toEqual(
      profile,
    )
  })

  it('throws 404 when not found', async () => {
    vi.mocked(GET_CHURCH_PROFILE).mockResolvedValue(null as never)
    await expect(
      getChurchProfile({ churchId: 'c1', churchIds: new Set(['c1']) }),
    ).rejects.toMatchObject({
      code: 404,
    })
  })
})

describe('patchChurchProfile', () => {
  const scope = new Set(['c1'])

  it('throws 403 when the church is outside the caller scope', async () => {
    await expect(
      patchChurchProfile({
        userId: 'u1',
        churchId: 'c9',
        churchIds: new Set(['c1']),
        input,
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 403 })
  })

  it('throws 409 STALE_VERSION on version mismatch', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(4 as never)
    await expect(
      patchChurchProfile({ userId: 'u1', churchId: 'c1', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(UPDATE_CHURCH_PROFILE).not.toHaveBeenCalled()
  })

  it('throws 422 for an unknown/disabled language', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['fi']) as never)
    await expect(
      patchChurchProfile({ userId: 'u1', churchId: 'c1', churchIds: scope, input, requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'UNKNOWN_LANGUAGE' })
  })

  it('throws 422 when the cover asset does not belong to this church', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']) as never)
    vi.mocked(GET_CHURCH_READY_IMAGE).mockResolvedValue(null as never)
    await expect(
      patchChurchProfile({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        input: { ...input, coverAssetId: '00000000-0000-0000-0000-000000000000' },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_COVER_ASSET' })
  })

  it('throws 422 when the hero asset does not belong to the target church', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']) as never)
    vi.mocked(GET_CHURCH_READY_IMAGE).mockResolvedValue(null)

    await expect(
      patchChurchProfile({
        userId: 'u1',
        churchId: 'c1',
        churchIds: new Set(['c1', 'c2']),
        input: { ...input, heroAssetId: '00000000-0000-0000-0000-000000000000' },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_HERO_ASSET' })
    expect(GET_CHURCH_READY_IMAGE).toHaveBeenCalledWith({
      churchIds: new Set(['c1']),
      assetId: '00000000-0000-0000-0000-000000000000',
    })
  })

  it('clears coordinates and updates the profile', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']) as never)
    vi.mocked(UPDATE_CHURCH_PROFILE).mockResolvedValue({ ...profile, version: 4 } as never)

    const res = await patchChurchProfile({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      input,
      requestId: 'r',
    })
    expect(res.version).toBe(4)
    expect(UPDATE_CHURCH_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, languageCodes: ['en'] }),
    )
    const payload = vi.mocked(UPDATE_CHURCH_PROFILE).mock.calls[0][0].payload
    expect(payload.latitude).toBeNull()
    expect(payload.longitude).toBeNull()
  })

  it('throws 422 when a gallery asset does not belong to this church or is not ready', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']) as never)
    vi.mocked(GET_CHURCH_READY_IMAGE).mockResolvedValue(null)

    await expect(
      patchChurchProfile({
        userId: 'u1',
        churchId: 'c1',
        churchIds: scope,
        input: {
          ...input,
          galleryItems: [{ mediaAssetId: '00000000-0000-0000-0000-000000000000', orderIndex: 0 }],
        },
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'INVALID_GALLERY_ASSET' })
  })

  it('passes galleryItems through to UPDATE_CHURCH_PROFILE', async () => {
    vi.mocked(GET_CHURCH_VERSION).mockResolvedValue(3 as never)
    vi.mocked(GET_AVAILABLE_LANGUAGE_CODES).mockResolvedValue(new Set(['en']) as never)
    vi.mocked(GET_CHURCH_READY_IMAGE).mockResolvedValue({ id: 'm1' } as never)
    vi.mocked(UPDATE_CHURCH_PROFILE).mockResolvedValue({ ...profile, version: 4 } as never)

    await patchChurchProfile({
      userId: 'u1',
      churchId: 'c1',
      churchIds: scope,
      input: {
        ...input,
        galleryItems: [{ mediaAssetId: 'm1', caption: 'Altar', orderIndex: 0 }],
      },
      requestId: 'r',
    })

    expect(UPDATE_CHURCH_PROFILE).toHaveBeenCalledWith(
      expect.objectContaining({
        galleryItems: [{ mediaAssetId: 'm1', caption: 'Altar', orderIndex: 0 }],
      }),
    )
  })
})
