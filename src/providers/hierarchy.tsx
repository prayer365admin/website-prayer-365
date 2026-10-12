import { Prisma, OrgNodeKind } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Org hierarchy provider (Task 19). Tree assembly and cycle / parent-type
 * validation live in the controller; this module only adapts Prisma.
 */

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
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
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
) =>
  tx.orgNode.create({
    data: {
      kind,
      name,
      parent_id: parentId ?? null,
      country_code: countryCode,
    },
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
