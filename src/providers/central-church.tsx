import { Prisma, ChurchStatus, OrgNodeKind } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { buildChurchSlug } from '@/utils/build-church-slug'

/*
 * Central church provider (Tasks 17-18). The controller orchestrates the
 * OrgNode+Church create transaction and the lifecycle transitions; this
 * module only adapts Prisma.
 */

export const GET_CHURCHES = async ({
  page,
  limit,
  order_direction,
  status,
  search,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
  status?: ChurchStatus
  search?: string
}) => {
  const where: Prisma.ChurchWhereInput = {
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  }
  const [total, rows] = await db.$transaction([
    db.church.count({ where }),
    db.church.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { created_at: order_direction },
      include: { org_node: { select: { id: true } } },
    }),
  ])
  return {
    total,
    result: rows.map((c) => ({
      id: c.id,
      orgNodeId: c.org_node_id,
      name: c.name,
      status: c.status,
      timezone: c.timezone,
      description: c.description,
      denomination: c.denomination,
      version: c.version,
      createdAt: c.created_at.toISOString(),
    })),
  }
}

export const GET_CHURCH_BY_ID = async ({ churchId }: { churchId: string }) =>
  db.church.findUnique({
    where: { id: churchId },
    include: {
      org_node: { select: { id: true, name: true, kind: true } },
      churchLanguages: { include: { language: true } },
    },
  })

export const GET_ORG_NODE_BY_ID = async ({ orgNodeId }: { orgNodeId: string }) =>
  db.orgNode.findUnique({ where: { id: orgNodeId } })

export const CREATE_ORG_NODE = async (
  {
    kind,
    name,
    parentId,
    countryCode,
  }: { kind: OrgNodeKind; name: string; parentId?: string; countryCode?: string },
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

export const CREATE_CHURCH = async (
  {
    orgNodeId,
    name,
    timezone,
    description,
    denomination,
    church_style,
    address,
    contacts,
    latitude,
    longitude,
    sunday_live_stream,
    taize_chants,
    youth_ministry,
  }: {
    orgNodeId: string
    name: string
    timezone: string
    description?: string | null
    denomination?: string | null
    church_style?: string | null
    address?: unknown
    contacts?: unknown
    latitude?: number | null
    longitude?: number | null
    sunday_live_stream?: boolean | null
    taize_chants?: boolean | null
    youth_ministry?: boolean | null
  },
  tx: Prisma.TransactionClient = db,
) => {
  const data: Prisma.ChurchUncheckedCreateInput = {
    org_node_id: orgNodeId,
    name,
    slug: await buildChurchSlug(name),
    timezone,
    description: description ?? null,
    denomination: denomination ?? null,
    church_style: church_style ?? null,
    address: (address ?? {}) as Prisma.InputJsonValue,
    contacts: (contacts ?? {}) as Prisma.InputJsonValue,
    social_links: {} as Prisma.InputJsonValue,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    sunday_live_stream: sunday_live_stream ?? null,
    taize_chants: taize_chants ?? null,
    youth_ministry: youth_ministry ?? null,
    status: 'PENDING',
  }
  return tx.church.create({ data })
}

export const UPDATE_CHURCH = async (
  {
    churchId,
    payload,
  }: {
    churchId: string
    payload: Prisma.ChurchUpdateInput
  },
  tx: Prisma.TransactionClient = db,
) => tx.church.update({ where: { id: churchId }, data: { ...payload, version: { increment: 1 } } })

export const UPDATE_CHURCH_STATUS = async (
  {
    churchId,
    status,
    approvedBy,
    approvedAt,
  }: {
    churchId: string
    status: ChurchStatus
    approvedBy?: string | null
    approvedAt?: Date | null
  },
  tx: Prisma.TransactionClient = db,
) =>
  tx.church.update({
    where: { id: churchId },
    data: {
      status,
      ...(approvedBy !== undefined ? { approved_by: approvedBy } : {}),
      ...(approvedAt !== undefined ? { approved_at: approvedAt } : {}),
      version: { increment: 1 },
    },
  })
