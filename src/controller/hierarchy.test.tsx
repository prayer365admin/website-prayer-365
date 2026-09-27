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
  GET_ORG_NODE_BY_ID: vi.fn(),
  UPDATE_ORG_NODE: vi.fn(),
}))

import { createNode, getHierarchyTree, updateNode } from './hierarchy'
import {
  CREATE_ORG_NODE,
  GET_ALL_ORG_NODES,
  GET_ORG_NODE_BY_ID,
  UPDATE_ORG_NODE,
} from '@/providers/hierarchy'

const globalNode = { id: 'root', parent_id: null, kind: 'GLOBAL', name: 'Root', country_code: null }
const countryNode = {
  id: 'ct',
  parent_id: 'root',
  kind: 'COUNTRY',
  name: 'Estonia',
  country_code: 'EE',
}
const dioceseNode = { id: 'dc', parent_id: 'ct', kind: 'DIOCESE', name: 'Dio', country_code: null }
const deaneryNode = { id: 'dn', parent_id: 'dc', kind: 'DEANERY', name: 'Dea', country_code: null }

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
      updateNode({ nodeId: 'ct', payload: { parentId: 'dc' }, actorId: 'actor', requestId: 'r' }),
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
      payload: { parentId: 'dc2' },
      actorId: 'actor',
      requestId: 'r',
    })
    expect(UPDATE_ORG_NODE).toHaveBeenCalled()
    expect(out).toBeDefined()
    void out
  })

  it('rejects re-parenting a non-GLOBAL node to null', async () => {
    vi.mocked(GET_ORG_NODE_BY_ID).mockResolvedValue(countryNode as never)
    await expect(
      updateNode({ nodeId: 'ct', payload: { parentId: null }, actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 422, error_code: 'PARENT_REQUIRED' })
  })
})

describe('getHierarchyTree', () => {
  it('assembles the tree from flat nodes', async () => {
    vi.mocked(GET_ALL_ORG_NODES).mockResolvedValue([globalNode, countryNode] as never)
    const tree = await getHierarchyTree()
    expect(tree[0].id).toBe('root')
    expect(tree[0].children[0].id).toBe('ct')
  })
})
