// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ auditLog: { create: vi.fn() } }),
  ),
}))

vi.mock('@/providers/central-church', () => ({
  CREATE_CHURCH: vi.fn(),
  CREATE_ORG_NODE: vi.fn(),
  GET_CHURCHES: vi.fn(),
  GET_CHURCH_BY_ID: vi.fn(),
  GET_ORG_NODE_BY_ID: vi.fn(),
  GET_ORG_NODE_MAP: vi.fn(),
  COUNT_CHURCH_DEPENDENTS: vi.fn(),
  DELETE_CHURCH_ROW: vi.fn(),
  DELETE_ORG_NODE_ROW: vi.fn(),
  UPDATE_CHURCH: vi.fn(),
  UPDATE_CHURCH_STATUS: vi.fn(),
  churchOrgPath: vi.fn(() => ({
    country: 'Estonia',
    countryCode: 'EE',
    organization: ['Tallinn Diocese', 'Harju Deanery'],
  })),
}))

import {
  approveChurch,
  archiveChurch,
  createChurch,
  getChurch,
  purgeChurch,
  suspendChurch,
  updateChurch,
} from './central-church'
import {
  COUNT_CHURCH_DEPENDENTS,
  CREATE_CHURCH,
  CREATE_ORG_NODE,
  DELETE_CHURCH_ROW,
  DELETE_ORG_NODE_ROW,
  GET_CHURCH_BY_ID,
  GET_ORG_NODE_BY_ID,
  GET_ORG_NODE_MAP,
  UPDATE_CHURCH_STATUS,
} from '@/providers/central-church'

const NO_DEPENDENTS = {
  prayers: 0,
  events: 0,
  announcements: 0,
  requests: 0,
  serviceTimes: 0,
  churchPastors: 0,
  voiceProfiles: 0,
  mediaAssets: 0,
  galleryItems: 0,
  donations: 0,
  donationSubscriptions: 0,
  checkIns: 0,
  analyticsEvents: 0,
  userChurches: 0,
  roleAssignments: 0,
}

const deanery = { id: 'd1', kind: 'DEANERY' }
const churchNode = { id: 'cnode', kind: 'CHURCH' }
const pendingChurch = {
  id: 'ch1',
  org_node_id: 'cnode',
  name: 'Church',
  status: 'PENDING',
  timezone: 'Europe/Tallinn',
  description: null,
  denomination: null,
  version: 1,
  created_at: new Date('2026-01-01'),
}
const approvedChurch = { ...pendingChurch, status: 'APPROVED' }

const payload = {
  name: 'New Church',
  timezone: 'Europe/Tallinn',
  parentId: 'd1',
}

describe('createChurch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the org CHURCH node and the PENDING church in one transaction (atomic)', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deanery as never)
    vi.mocked(CREATE_ORG_NODE).mockResolvedValue({ id: 'cnode' } as never)
    vi.mocked(CREATE_CHURCH).mockResolvedValue(pendingChurch as never)

    const out = await createChurch({ payload, actorId: 'actor', requestId: 'r' })

    expect(CREATE_ORG_NODE).toHaveBeenCalledWith(
      { kind: 'CHURCH', name: 'New Church', parentId: 'd1' },
      expect.anything(),
    )
    expect(CREATE_CHURCH).toHaveBeenCalled()
    expect(out).toMatchObject({ id: 'ch1', status: 'PENDING' })
  })

  it('rejects an invalid parent kind (CHURCH under CHURCH) 422', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(churchNode as never)
    await expect(createChurch({ payload, actorId: 'actor', requestId: 'r' })).rejects.toMatchObject(
      { code: 422, error_code: 'INVALID_PARENT_KIND' },
    )
    expect(CREATE_ORG_NODE).not.toHaveBeenCalled()
  })

  it('rejects a missing parent node 404', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(null as never)
    await expect(createChurch({ payload, actorId: 'actor', requestId: 'r' })).rejects.toMatchObject(
      { code: 404, error_code: 'PARENT_NODE_NOT_FOUND' },
    )
  })
})

describe('updateChurch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a stale version (409)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ ...pendingChurch, version: 5 } as never)
    await expect(
      updateChurch({
        churchId: 'ch1',
        payload: { version: 4, name: 'X' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })
})

describe('approveChurch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is idempotent for an already-approved church (no duplicate approval)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(approvedChurch as never)
    const out = await approveChurch({
      churchId: 'ch1',
      version: 1,
      actorId: 'actor',
      requestId: 'r',
    })
    expect(out).toMatchObject({ status: 'APPROVED' })
    expect(UPDATE_CHURCH_STATUS).not.toHaveBeenCalled()
  })

  it('validates required setup before approving (422 when timezone missing)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ ...pendingChurch, timezone: '' } as never)
    await expect(
      approveChurch({ churchId: 'ch1', version: 1, actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'REQUIRED_SETUP' })
  })

  it('approves and records actor/time', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(pendingChurch as never)
    vi.mocked(UPDATE_CHURCH_STATUS).mockResolvedValue(approvedChurch as never)
    const out = await approveChurch({
      churchId: 'ch1',
      version: 1,
      actorId: 'actor',
      requestId: 'r',
    })
    expect(UPDATE_CHURCH_STATUS).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: 'ch1',
        status: 'APPROVED',
        approvedBy: 'actor',
        approvedAt: expect.any(Date),
      }),
      expect.anything(),
    )
    expect(out.status).toBe('APPROVED')
  })
})

describe('suspend / archive', () => {
  beforeEach(() => vi.clearAllMocks())

  it('suspends an approved church', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(approvedChurch as never)
    vi.mocked(UPDATE_CHURCH_STATUS).mockResolvedValue({
      ...approvedChurch,
      status: 'SUSPENDED',
    } as never)
    await expect(
      suspendChurch({ churchId: 'ch1', version: 1, actorId: 'actor', requestId: 'r' }),
    ).resolves.toMatchObject({ status: 'SUSPENDED' })
  })

  it('refuses to archive an already-archived church (no destructive re-run)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ ...pendingChurch, status: 'ARCHIVED' } as never)
    await expect(
      archiveChurch({ churchId: 'ch1', version: 1, actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'INVALID_TRANSITION' })
  })
})

describe('getChurch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the setup detail with the organization path for the S16 header', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({
      ...pendingChurch,
      church_style: null,
      latitude: null,
      longitude: null,
      sunday_live_stream: null,
      taize_chants: null,
      youth_ministry: null,
      approved_at: null,
    } as never)
    vi.mocked(GET_ORG_NODE_MAP).mockResolvedValue(new Map() as never)

    const out = await getChurch({ churchId: 'ch1' })

    expect(out).toMatchObject({
      id: 'ch1',
      name: 'Church',
      status: 'PENDING',
      country: 'Estonia',
      organization: ['Tallinn Diocese', 'Harju Deanery'],
    })
  })

  it('404s for an unknown church', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(null as never)
    await expect(getChurch({ churchId: 'gone' })).rejects.toMatchObject({
      code: 404,
      error_code: 'CHURCH_NOT_FOUND',
    })
  })
})

describe('purgeChurch', () => {
  beforeEach(() => vi.clearAllMocks())

  const purge = (payload = { version: 1, confirmName: 'Church' }) =>
    purgeChurch({ churchId: 'ch1', payload, actorId: 'actor', requestId: 'r' })

  it('404s for an unknown church', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(null as never)
    await expect(purge()).rejects.toMatchObject({ code: 404, error_code: 'CHURCH_NOT_FOUND' })
    expect(DELETE_CHURCH_ROW).not.toHaveBeenCalled()
  })

  it('refuses a stale version (409)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue({ ...pendingChurch, version: 5 } as never)
    await expect(purge()).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
    expect(DELETE_CHURCH_ROW).not.toHaveBeenCalled()
  })

  it('refuses an approved church — archive is the removal for it (409)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(approvedChurch as never)
    await expect(purge()).rejects.toMatchObject({
      code: 409,
      error_code: 'INVALID_TRANSITION',
    })
    expect(COUNT_CHURCH_DEPENDENTS).not.toHaveBeenCalled()
    expect(DELETE_CHURCH_ROW).not.toHaveBeenCalled()
  })

  it('refuses a mistyped confirmation (422)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(pendingChurch as never)
    await expect(purge({ version: 1, confirmName: 'Other Church' })).rejects.toMatchObject({
      code: 422,
      error_code: 'CONFIRMATION_MISMATCH',
    })
    expect(DELETE_CHURCH_ROW).not.toHaveBeenCalled()
  })

  it('accepts the name with surrounding whitespace', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(pendingChurch as never)
    vi.mocked(COUNT_CHURCH_DEPENDENTS).mockResolvedValue(NO_DEPENDENTS as never)

    await expect(purge({ version: 1, confirmName: '  Church  ' })).resolves.toBeUndefined()
    expect(DELETE_CHURCH_ROW).toHaveBeenCalled()
  })

  it('refuses a church with dependents and reports the blocking counts (409)', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(pendingChurch as never)
    vi.mocked(COUNT_CHURCH_DEPENDENTS).mockResolvedValue({
      ...NO_DEPENDENTS,
      prayers: 2,
      donations: 1,
    } as never)

    await expect(purge()).rejects.toMatchObject({
      code: 409,
      error_code: 'CHURCH_HAS_CONTENT',
      fields: { prayers: '2', donations: '1' },
    })
    expect(DELETE_CHURCH_ROW).not.toHaveBeenCalled()
  })

  it('deletes the church and its org node in one transaction and audits the purge', async () => {
    vi.mocked(GET_CHURCH_BY_ID).mockResolvedValue(pendingChurch as never)
    vi.mocked(COUNT_CHURCH_DEPENDENTS).mockResolvedValue(NO_DEPENDENTS as never)

    await expect(purge()).resolves.toBeUndefined()

    expect(DELETE_CHURCH_ROW).toHaveBeenCalledWith({ churchId: 'ch1' }, expect.anything())
    expect(DELETE_ORG_NODE_ROW).toHaveBeenCalledWith({ orgNodeId: 'cnode' }, expect.anything())
  })
})
