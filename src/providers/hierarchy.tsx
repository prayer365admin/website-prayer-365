import { Prisma, OrgNodeKind } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Org hierarchy provider (Task 19). Tree assembly and cycle / parent-type
 * validation live in the controller; this module only adapts Prisma.
 */

export const GET_ALL_ORG_NODES = async () =>
  db.orgNode.findMany({
    select: { id: true, parent_id: true, kind: true, name: true, country_code: true },
  })

export const GET_ORG_NODE_BY_ID = async ({ nodeId }: { nodeId: string }) =>
  db.orgNode.findUnique({ where: { id: nodeId } })

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

export const UPDATE_ORG_NODE = async (
  { nodeId, payload }: { nodeId: string; payload: Prisma.OrgNodeUncheckedUpdateInput },
  tx: Prisma.TransactionClient = db,
) => tx.orgNode.update({ where: { id: nodeId }, data: payload })
