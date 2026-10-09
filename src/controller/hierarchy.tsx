import { HIERARCHY_PARENT, HierarchyNode, NodeCreate, NodeUpdate } from '@/models/hierarchy'
import {
  CREATE_ORG_NODE,
  GET_ALL_ORG_NODES,
  GET_ORG_NODE_BY_COUNTRY,
  GET_ORG_NODE_BY_ID,
  UPDATE_ORG_NODE,
} from '@/providers/hierarchy'
import { GET_COUNTRY_BY_CODE } from '@/providers/registry'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'
import { OrgNodeKind } from '@prisma/client'

/*
 * Org hierarchy business logic (SPEC §8.3 / Task 19). Parent-type
 * compatibility (GLOBAL>COUNTRY>DIOCESE>DEANERY>CHURCH) is enforced and any
 * re-parent that would introduce a cycle is rejected.
 */

const notFound = (error_code = 'NODE_NOT_FOUND') =>
  new GeneralError({ code: 404, error: 'NOT_FOUND', error_code, details: 'Resource not found.' })

const validation = (error_code: string, details: string) =>
  new GeneralError({ code: 422, error: 'VALIDATION_ERROR', error_code, details })

const cycle = () =>
  new GeneralError({
    code: 400,
    error: 'BAD_REQUEST',
    error_code: 'HIERARCHY_CYCLE',
    details: 'The proposed parent would create a cycle in the hierarchy.',
  })

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'This node has changed. Refresh and try again.',
  })

interface FlatNode {
  id: string
  parent_id: string | null
  kind: OrgNodeKind
  name: string
  country_code: string | null
  version: number
}

const isDescendantOf = (candidate: string, ancestor: string, nodes: FlatNode[]): boolean => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let cur: FlatNode | undefined = byId.get(candidate)
  while (cur) {
    if (cur.id === ancestor) return true
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return false
}

export const getHierarchyTree = async (): Promise<HierarchyNode[]> => {
  const nodes = await GET_ALL_ORG_NODES()
  const byId = new Map<string, HierarchyNode>()
  for (const n of nodes) {
    byId.set(n.id, {
      id: n.id,
      kind: n.kind,
      name: n.name,
      parentId: n.parent_id,
      countryCode: n.country_code,
      version: n.version,
      children: [],
    })
  }
  const roots: HierarchyNode[] = []
  for (const n of nodes) {
    const node = byId.get(n.id)!
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(node)
    else roots.push(node)
  }
  return roots
}

const assertCountryAvailable = async (payload: NodeCreate) => {
  if (!payload.countryCode) {
    throw validation('COUNTRY_CODE_REQUIRED', 'A COUNTRY node requires a countryCode.')
  }
  const country = await GET_COUNTRY_BY_CODE({ code: payload.countryCode })
  if (!country) throw notFound('COUNTRY_NOT_FOUND')
  if (!country.enabled) {
    throw validation('COUNTRY_DISABLED', 'A disabled country cannot receive a new node.')
  }
  if (await GET_ORG_NODE_BY_COUNTRY({ countryCode: payload.countryCode })) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'COUNTRY_NODE_EXISTS',
      details: 'This country already has a hierarchy node.',
    })
  }
}

export const createNode = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: NodeCreate
  actorId: string
  requestId: string
}) => {
  const expectedParent = HIERARCHY_PARENT[payload.kind]

  if (payload.kind === 'GLOBAL') {
    if (payload.parentId)
      throw validation('INVALID_PARENT', 'The GLOBAL root cannot have a parent.')
  } else {
    if (!payload.parentId)
      throw validation('PARENT_REQUIRED', 'A non-GLOBAL node requires a parent.')
    const parent = await GET_ORG_NODE_BY_ID({ nodeId: payload.parentId })
    if (!parent) throw notFound('PARENT_NODE_NOT_FOUND')
    if (parent.kind !== expectedParent) {
      throw validation(
        'KIND_PARENT_MISMATCH',
        `A ${payload.kind} node must be placed under a ${expectedParent} node.`,
      )
    }
  }

  if (payload.kind === 'COUNTRY') {
    await assertCountryAvailable(payload)
  } else if (payload.countryCode) {
    throw validation(
      'COUNTRY_CODE_ONLY_FOR_COUNTRY',
      'countryCode may only be set on a COUNTRY node.',
    )
  }

  return dbTransaction(async (tx) => {
    const row = await CREATE_ORG_NODE(
      {
        kind: payload.kind,
        name: payload.name,
        parentId: payload.parentId ?? null,
        countryCode: payload.countryCode,
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'hierarchy.create',
        resourceType: 'org_node',
        resourceId: row.id,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const updateNode = async ({
  nodeId,
  payload,
  actorId,
  requestId,
}: {
  nodeId: string
  payload: NodeUpdate
  actorId: string
  requestId: string
}) => {
  const node = await GET_ORG_NODE_BY_ID({ nodeId })
  if (!node) throw notFound()

  // The church record owns its name; renaming only the node would desync them.
  if (node.kind === 'CHURCH' && payload.name !== undefined && payload.name !== node.name) {
    throw validation('CHURCH_RENAME_VIA_PROFILE', 'Rename a church from its church profile.')
  }

  if (payload.parentId !== undefined) {
    if (payload.parentId === nodeId) throw cycle()
    if (payload.parentId !== null) {
      const nodes = (await GET_ALL_ORG_NODES()) as unknown as FlatNode[]
      const parent = nodes.find((n) => n.id === payload.parentId)
      if (!parent) throw notFound('PARENT_NODE_NOT_FOUND')
      // A cycle is rejected first: the new parent must not be a descendant.
      if (isDescendantOf(payload.parentId, nodeId, nodes)) throw cycle()
      const expectedParent = HIERARCHY_PARENT[node.kind]
      if (parent.kind !== expectedParent) {
        throw validation(
          'KIND_PARENT_MISMATCH',
          `A ${node.kind} node must be placed under a ${expectedParent} node.`,
        )
      }
    } else if (node.kind !== 'GLOBAL') {
      throw validation('PARENT_REQUIRED', 'Only the GLOBAL root may have no parent.')
    }
  }

  const moved = payload.parentId !== undefined && payload.parentId !== node.parent_id

  return dbTransaction(async (tx) => {
    const row = await UPDATE_ORG_NODE(
      {
        nodeId,
        expectedVersion: payload.version,
        payload: { name: payload.name, parent_id: payload.parentId },
      },
      tx,
    )
    if (!row) throw stale()
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        // Reassignment is audited separately: it changes descendant reporting scope (D8).
        action: moved ? 'hierarchy.move' : 'hierarchy.update',
        resourceType: 'org_node',
        resourceId: nodeId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}
