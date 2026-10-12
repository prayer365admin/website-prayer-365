// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ auditLog: { create: vi.fn() } }),
  ),
}))

vi.mock('@/providers/hierarchy', () => ({
  CREATE_ORG_NODE: vi.fn(),
  GET_ALL_ORG_NODES: vi.fn(),
  GET_ORG_NODE_BY_COUNTRY: vi.fn(),
  GET_ORG_NODE_BY_ID: vi.fn(),
  UPDATE_ORG_NODE: vi.fn(),
}))

vi.mock('@/providers/registry', () => ({
  GET_COUNTRY_BY_CODE: vi.fn(),
}))

import { createNode, getHierarchyTree, updateNode } from './hierarchy'
import {
  CREATE_ORG_NODE,
  GET_ALL_ORG_NODES,
  GET_ORG_NODE_BY_COUNTRY,
  GET_ORG_NODE_BY_ID,
  UPDATE_ORG_NODE,
} from '@/providers/hierarchy'
import { GET_COUNTRY_BY_CODE } from '@/providers/registry'

const globalNode = {
  id: 'root',
  parent_id: null,
  kind: 'GLOBAL',
  name: 'Root',
  country_code: null,
  version: 1,
}
const countryNode = {
  id: 'ct',
  parent_id: 'root',
  kind: 'COUNTRY',
  name: 'Estonia',
  country_code: 'EE',
  version: 1,
}
const dioceseNode = {
  id: 'dc',
  parent_id: 'ct',
  kind: 'DIOCESE',
  name: 'Dio',
  country_code: null,
  version: 1,
}
const deaneryNode = {
  id: 'dn',
  parent_id: 'dc',
  kind: 'DEANERY',
  name: 'Dea',
  country_code: null,
  version: 1,
}

describe('createNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enforces parent-type compatibility (422 KIND_PARENT_MISMATCH)', async () => {
    // DIOCESE under DEANERY is invalid (DIOCESE must be under COUNTRY)
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deaneryNode as never)
    await expect(
      createNode({
        payload: { kind: 'DIOCESE', parentId: 'dn', name: 'Bad' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'KIND_PARENT_MISMATCH' })
    expect(CREATE_ORG_NODE).not.toHaveBeenCalled()
  })

  it('requires countryCode on COUNTRY nodes', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(globalNode as never)
    await expect(
      createNode({
        payload: { kind: 'COUNTRY', parentId: 'root', name: 'X' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'COUNTRY_CODE_REQUIRED' })
  })

  it('rejects a COUNTRY node for a disabled country (422 COUNTRY_DISABLED)', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(globalNode as never)
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue({ code: 'LV', enabled: false } as never)
    await expect(
      createNode({
        payload: { kind: 'COUNTRY', parentId: 'root', name: 'Latvia', countryCode: 'LV' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'COUNTRY_DISABLED' })
    expect(CREATE_ORG_NODE).not.toHaveBeenCalled()
  })

  it('rejects a second COUNTRY node for the same country (409)', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(globalNode as never)
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue({ code: 'EE', enabled: true } as never)
    vi.mocked(GET_ORG_NODE_BY_COUNTRY).mockResolvedValue({ id: 'ct' } as never)
    await expect(
      createNode({
        payload: { kind: 'COUNTRY', parentId: 'root', name: 'Estonia', countryCode: 'EE' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'COUNTRY_NODE_EXISTS' })
  })

  it('creates a valid node with a compatible parent', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(countryNode as never)
    vi.mocked(CREATE_ORG_NODE).mockResolvedValue({ id: 'new' } as never)
    await expect(
      createNode({
        payload: { kind: 'DIOCESE', parentId: 'ct', name: 'Tartu Diocese' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).resolves.toBeDefined()
    expect(CREATE_ORG_NODE).toHaveBeenCalled()
  })
})

describe('updateNode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a re-parent that would create a cycle', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(countryNode as never)
    // Try to move COUNTRY 'ct' under its own DIOCESE descendant 'dc' → cycle.
    vi.mocked(GET_ALL_ORG_NODES).mockResolvedValue([
      globalNode,
      countryNode,
      dioceseNode,
      deaneryNode,
    ] as never)

    await expect(
      updateNode({
        nodeId: 'ct',
        payload: { version: 1, parentId: 'dc' },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 400, error_code: 'HIERARCHY_CYCLE' })
    expect(UPDATE_ORG_NODE).not.toHaveBeenCalled()
  })

  it('allows a valid re-parent that is not a cycle', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deaneryNode as never)
    // A DEANERY may move to a DIFFERENT DIOCESE (valid parent type, no cycle).
    vi.mocked(GET_ALL_ORG_NODES).mockResolvedValue([
      globalNode,
      countryNode,
      dioceseNode,
      { id: 'dc2', parent_id: 'ct', kind: 'DIOCESE', name: 'Dio2', country_code: null },
      deaneryNode,
    ] as never)
    vi.mocked(UPDATE_ORG_NODE).mockResolvedValue({ id: 'dn' } as never)

    const out = await updateNode({
      nodeId: 'dn',
      payload: { version: 1, parentId: 'dc2' },
      actorId: 'actor',
      requestId: 'r',
    })
    expect(UPDATE_ORG_NODE).toHaveBeenCalled()
    expect(out).toBeDefined()
    void out
  })

  it('refuses to rename a CHURCH node (church record owns the name)', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue({
      id: 'ch',
      parent_id: 'dn',
      kind: 'CHURCH',
      name: 'St Mary',
      country_code: null,
      version: 1,
    } as never)
    await expect(
      updateNode({
        nodeId: 'ch',
        payload: { version: 1, name: 'Renamed' },
        actorId: 'a',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'CHURCH_RENAME_VIA_PROFILE' })
    expect(UPDATE_ORG_NODE).not.toHaveBeenCalled()
  })

  it('rejects a self-parent as a cycle', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deaneryNode as never)
    await expect(
      updateNode({
        nodeId: 'dn',
        payload: { version: 1, parentId: 'dn' },
        actorId: 'a',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 400, error_code: 'HIERARCHY_CYCLE' })
  })

  it('returns 409 STALE_VERSION when the node changed', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deaneryNode as never)
    vi.mocked(UPDATE_ORG_NODE).mockResolvedValue(null as never)
    await expect(
      updateNode({
        nodeId: 'dn',
        payload: { version: 1, name: 'New' },
        actorId: 'a',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'STALE_VERSION' })
  })

  it('audits a parent change as hierarchy.move', async () => {
    const audit = vi.fn()
    const { dbTransaction } = await import('@/utils/db-transaction')
    vi.mocked(dbTransaction).mockImplementationOnce(async (fn) =>
      fn({ auditLog: { create: audit } } as never),
    )
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(deaneryNode as never)
    vi.mocked(GET_ALL_ORG_NODES).mockResolvedValue([
      globalNode,
      countryNode,
      dioceseNode,
      { id: 'dc2', parent_id: 'ct', kind: 'DIOCESE', name: 'Dio2', country_code: null, version: 1 },
      deaneryNode,
    ] as never)
    vi.mocked(UPDATE_ORG_NODE).mockResolvedValue({ id: 'dn' } as never)
    await updateNode({
      nodeId: 'dn',
      payload: { version: 1, parentId: 'dc2' },
      actorId: 'a',
      requestId: 'r',
    })
    expect(UPDATE_ORG_NODE).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'dn', expectedVersion: 1 }),
      expect.anything(),
    )
    expect(audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'hierarchy.move' }),
    })
  })

  it('rejects re-parenting a non-GLOBAL node to null', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(countryNode as never)
    await expect(
      updateNode({
        nodeId: 'ct',
        payload: { version: 1, parentId: null },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 422, error_code: 'PARENT_REQUIRED' })
  })
})

describe('getHierarchyTree', () => {
  it('assembles the tree from flat nodes', async () => {
    vi.mocked(GET_ALL_ORG_NODES).mockResolvedValue([globalNode, countryNode] as never)
    const tree = await getHierarchyTree()
    expect(tree[0].id).toBe('root')
    expect(tree[0].children[0].id).toBe('ct')
    expect(tree[0].children[0]).toMatchObject({ countryCode: 'EE', version: 1 })
  })
})
