import { Prisma, OrgNode, OrgNodeKind } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Org hierarchy provider (Task 19). Tree assembly and cycle / parent-type
 * validation live in the controller; this module only adapts Prisma.
 */

/** Display order of siblings: explicit position first, name as the tie-break. */
const SIBLING_ORDER: Prisma.OrgNodeOrderByWithRelationInput[] = [
  { sort_order: 'asc' },
  { name: 'asc' },
  { id: 'asc' },
]

export const GET_ALL_ORG_NODES = async () =>
  db.orgNode.findMany({
    select: {
      id: true,
      parent_id: true,
      kind: true,
      name: true,
      country_code: true,
      version: true,
    },
    orderBy: SIBLING_ORDER,
  })

export const GET_ORG_NODE_BY_ID = async ({ nodeId }: { nodeId: string }) =>
  db.orgNode.findUnique({ where: { id: nodeId } })

export const GET_ORG_NODE_BY_COUNTRY = async ({ countryCode }: { countryCode: string }) =>
  db.orgNode.findUnique({ where: { country_code: countryCode }, select: { id: true } })

export const CREATE_ORG_NODE = async (
  {
    kind,
    name,
    parentId,
    countryCode,
  }: { kind: OrgNodeKind; name: string; parentId?: string | null; countryCode?: string },
  tx: Prisma.TransactionClient = db,
) => {
  // New nodes land last among their siblings.
  const last = await tx.orgNode.aggregate({
    where: { parent_id: parentId ?? null },
    _max: { sort_order: true },
  })
  return tx.orgNode.create({
    data: {
      kind,
      name,
      parent_id: parentId ?? null,
      country_code: countryCode,
      sort_order: (last._max.sort_order ?? -1) + 1,
    },
  })
}

/**
 * The country registry owns a COUNTRY node's name; keep the tree in step when
 * the registry renames it. Bumps the node version so an open edit goes stale.
 */
export const RENAME_COUNTRY_ORG_NODE = async (
  { countryCode, name }: { countryCode: string; name: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.orgNode.updateMany({
    where: { country_code: countryCode },
    data: { name, version: { increment: 1 } },
  })

/** Version-guarded update; returns null when `expectedVersion` is stale. */
export const UPDATE_ORG_NODE = async (
  {
    nodeId,
    expectedVersion,
    payload,
  }: { nodeId: string; expectedVersion: number; payload: Prisma.OrgNodeUncheckedUpdateInput },
  tx: Prisma.TransactionClient = db,
) => {
  const updated = await tx.orgNode.updateMany({
    where: { id: nodeId, version: expectedVersion },
    data: { ...payload, version: { increment: 1 } },
  })
  if (updated.count === 0) return null
  return tx.orgNode.findUnique({ where: { id: nodeId } })
}

/**
 * Swaps a node with its previous/next sibling and renumbers the whole sibling
 * set. The renumbering is what makes the order deterministic when existing
 * rows still share the default `sort_order` of 0.
 */
export const REORDER_ORG_NODE = async ({
  nodeId,
  expectedVersion,
  direction,
  tx,
}: {
  nodeId: string
  expectedVersion: number
  direction: 'up' | 'down'
  tx: Prisma.TransactionClient
}): Promise<'not-found' | 'no-sibling' | 'stale' | OrgNode> => {
  const node = await tx.orgNode.findUnique({ where: { id: nodeId }, select: { parent_id: true } })
  if (!node) return 'not-found'
  if (node.parent_id === null) return 'no-sibling'

  const siblings = await tx.orgNode.findMany({
    where: { parent_id: node.parent_id },
    select: { id: true },
    orderBy: SIBLING_ORDER,
  })
  const index = siblings.findIndex((s) => s.id === nodeId)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || target < 0 || target >= siblings.length) return 'no-sibling'

  const guard = await tx.orgNode.updateMany({
    where: { id: nodeId, version: expectedVersion },
    data: { version: { increment: 1 } },
  })
  if (guard.count === 0) return 'stale'

  const order = siblings.map((s) => s.id)
  ;[order[index], order[target]] = [order[target], order[index]]
  await Promise.all(
    order.map((id, position) =>
      tx.orgNode.update({ where: { id }, data: { sort_order: position } }),
    ),
  )
  // The version guard above updated this row, so it exists.
  return tx.orgNode.findUniqueOrThrow({ where: { id: nodeId } })
}
