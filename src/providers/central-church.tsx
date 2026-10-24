import { Prisma, ChurchStatus, OrgNodeKind } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { buildChurchSlug } from '@/utils/build-church-slug'
import { CUSTOMER_ACCOUNT_FILTER } from '@/utils/customer-role'

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
  const [total, rows, nodes] = await Promise.all([
    db.church.count({ where }),
    db.church.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { created_at: order_direction },
      include: { org_node: { select: { id: true } } },
    }),
    GET_ORG_NODE_MAP(),
  ])
  return {
    total,
    result: rows.map((c) => {
      const path = churchOrgPath(nodes, c.org_node_id)
      return {
        id: c.id,
        orgNodeId: c.org_node_id,
        name: c.name,
        status: c.status,
        timezone: c.timezone,
        description: c.description,
        denomination: c.denomination,
        church_style: c.church_style,
        ...path,
        version: c.version,
        createdAt: c.created_at.toISOString(),
      }
    }),
  }
}

export type OrgNodeRow = {
  id: string
  parent_id: string | null
  kind: OrgNodeKind
  name: string
  country_code: string | null
}

/**
 * The org tree is small (global → country → diocese → deanery → church nodes),
 * so one read serves every row of a page. Deep nested `include`s are avoided on
 * purpose: Prisma 7 here runs `@prisma/adapter-pg`, which rejects
 * `relationLoadStrategy`, so each include level is its own round trip.
 */
export const GET_ORG_NODE_MAP = async (): Promise<Map<string, OrgNodeRow>> => {
  const nodes = await db.orgNode.findMany({
    select: { id: true, parent_id: true, kind: true, name: true, country_code: true },
  })
  return new Map(nodes.map((n) => [n.id, n]))
}

/** Country + organization labels for the S15 columns and the S16 header. */
export const churchOrgPath = (
  nodes: Map<string, OrgNodeRow>,
  orgNodeId: string,
): { country: string | null; countryCode: string | null; organization: string[] } => {
  const chain: OrgNodeRow[] = []
  let cursor = nodes.get(orgNodeId)?.parent_id ?? null
  while (cursor) {
    const node = nodes.get(cursor)
    if (!node) break
    chain.unshift(node)
    cursor = node.parent_id
  }
  const countryNode = chain.find((n) => n.kind === 'COUNTRY')
  return {
    country: countryNode?.name ?? null,
    countryCode:
      countryNode?.country_code ?? chain.find((n) => n.country_code)?.country_code ?? null,
    organization: chain
      .filter((n) => n.kind === 'DIOCESE' || n.kind === 'DEANERY')
      .map((n) => n.name),
  }
}

/**
 * Every table that blocks a hard delete. A church that was ever approved — or
 * that holds a single prayer, event, member link or donation — must be archived
 * instead of purged (SPEC §4 deletion policy, plan 020 D-A).
 */
export const COUNT_CHURCH_DEPENDENTS = async ({
  churchId,
  orgNodeId,
}: {
  churchId: string
  orgNodeId: string
}) => {
  const [
    prayers,
    events,
    announcements,
    requests,
    serviceTimes,
    churchPastors,
    voiceProfiles,
    mediaAssets,
    galleryItems,
    donations,
    donationSubscriptions,
    checkIns,
    analyticsEvents,
    userChurches,
    roleAssignments,
  ] = await db.$transaction([
    db.prayer.count({ where: { church_id: churchId } }),
    db.event.count({ where: { church_id: churchId } }),
    db.announcement.count({ where: { church_id: churchId } }),
    db.request.count({ where: { church_id: churchId } }),
    db.serviceTime.count({ where: { church_id: churchId } }),
    db.churchPastor.count({ where: { church_id: churchId } }),
    db.voiceProfile.count({ where: { church_id: churchId } }),
    db.mediaAsset.count({ where: { church_id: churchId } }),
    db.churchGalleryItem.count({ where: { church_id: churchId } }),
    db.donation.count({ where: { church_id: churchId } }),
    db.donationSubscription.count({ where: { church_id: churchId } }),
    db.checkIn.count({ where: { church_id: churchId } }),
    db.analyticsEvent.count({ where: { church_id: churchId } }),
    db.userChurch.count({ where: { church_id: churchId, user: CUSTOMER_ACCOUNT_FILTER } }),
    db.roleAssignment.count({ where: { org_node_id: orgNodeId } }),
  ])
  return {
    prayers,
    events,
    announcements,
    requests,
    serviceTimes,
    churchPastors,
    voiceProfiles,
    mediaAssets,
    galleryItems,
    donations,
    donationSubscriptions,
    checkIns,
    analyticsEvents,
    userChurches,
    roleAssignments,
  }
}

export const DELETE_CHURCH_ROW = async (
  { churchId }: { churchId: string },
  tx: Prisma.TransactionClient = db,
) => tx.church.delete({ where: { id: churchId } })

export const DELETE_ORG_NODE_ROW = async (
  { orgNodeId }: { orgNodeId: string },
  tx: Prisma.TransactionClient = db,
) => tx.orgNode.delete({ where: { id: orgNodeId } })

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
