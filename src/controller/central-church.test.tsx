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
  UPDATE_CHURCH: vi.fn(),
  UPDATE_CHURCH_STATUS: vi.fn(),
}))

import {
  approveChurch,
  archiveChurch,
  createChurch,
  suspendChurch,
  updateChurch,
} from './central-church'
import {
  CREATE_CHURCH,
  CREATE_ORG_NODE,
  GET_CHURCH_BY_ID,
  GET_ORG_NODE_BY_ID,
  UPDATE_CHURCH_STATUS,
} from '@/providers/central-church'

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
