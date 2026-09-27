import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { auditPayload } from '@/utils/audit'
import { ChurchPastorSummary } from '@/models/pastor'

/*
 * Pastor adapters.
 * Central pastor provider (Task 20): central authority edits the shared
 * profile; church assignment upserts church_pastor links and removes links
 * no longer assigned — Pastor rows are never deleted, so historical
 * attribution is preserved.
 * Church-scoped provider (Task 15): reads are scoped by `churchIds`; PATCH
 * updates only church-scoped assignment fields (pastoral_role,
 * image_asset_id), gated by the church `version` for stale conflicts.
 */

export const GET_PASTORS = async ({
  page,
  limit,
  order_direction,
  search,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
  search?: string
}) => {
  const where: Prisma.PastorWhereInput = search
    ? { name: { contains: search, mode: 'insensitive' as const } }
    : {}
  const [total, result] = await db.$transaction([
    db.pastor.count({ where }),
    db.pastor.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { name: order_direction },
    }),
  ])
  return { total, result }
}

export const GET_PASTOR_BY_ID = async ({ pastorId }: { pastorId: string }) =>
  db.pastor.findUnique({ where: { id: pastorId } })

export const GET_PASTOR_BY_USER_ID = async ({ userId }: { userId: string }) =>
  db.pastor.findUnique({ where: { user_id: userId } })

export const GET_USER_BY_ID = async ({ userId }: { userId: string }) =>
  db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })

export const CREATE_PASTOR = async (
  payload: Prisma.PastorUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.pastor.create({ data: payload })

export const UPDATE_PASTOR = async (
  { pastorId, payload }: { pastorId: string; payload: Prisma.PastorUncheckedUpdateInput },
  tx: Prisma.TransactionClient = db,
) => tx.pastor.update({ where: { id: pastorId }, data: payload })

export const GET_CHURCH_BY_ID = async ({ churchId }: { churchId: string }) =>
  db.church.findUnique({ where: { id: churchId }, select: { id: true, org_node_id: true } })

export const UPSERT_CHURCH_PASTOR = async (
  {
    churchId,
    pastorId,
    pastoralRole,
    imageAssetId,
    activeVoiceProfileId,
  }: {
    churchId: string
    pastorId: string
    pastoralRole: string
    imageAssetId?: string | null
    activeVoiceProfileId?: string | null
  },
  tx: Prisma.TransactionClient = db,
) =>
  tx.churchPastor.upsert({
    where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorId } },
    create: {
      church_id: churchId,
      pastor_id: pastorId,
      pastoral_role: pastoralRole,
      image_asset_id: imageAssetId ?? null,
      active_voice_profile_id: activeVoiceProfileId ?? null,
    },
    update: {
      pastoral_role: pastoralRole,
      image_asset_id: imageAssetId ?? null,
      active_voice_profile_id: activeVoiceProfileId ?? null,
    },
  })

export const DELETE_CHURCH_PASTORS_NOT_IN = async (
  { churchId, pastorIds }: { churchId: string; pastorIds: string[] },
  tx: Prisma.TransactionClient = db,
) =>
  tx.churchPastor.deleteMany({
    where: { church_id: churchId, pastor_id: { notIn: pastorIds } },
  })

// ============================================================================
// Task 15 — church-scoped pastor reads and assignment patch
// ============================================================================

const mapChRow = (r: {
  pastor_id: string
  pastoral_role: string
  image_asset_id: string | null
  pastor: { name: string; introduction: string | null }
}): ChurchPastorSummary => ({
  id: r.pastor_id,
  name: r.pastor.name,
  introduction: r.pastor.introduction,
  pastoralRole: r.pastoral_role,
  imageAssetId: r.image_asset_id,
})

export const GET_CHURCH_PASTORS = async ({
  churchIds,
}: {
  churchIds: Set<string>
}): Promise<ChurchPastorSummary[]> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return []
  const rows = await db.churchPastor.findMany({
    where: { church_id: { in: ids } },
    include: { pastor: { select: { name: true, introduction: true } } },
    orderBy: { pastor_id: 'asc' },
  })
  return rows.map(mapChRow)
}

export const GET_CHURCH_PASTOR = async ({
  churchIds,
  pastorId,
}: {
  churchIds: Set<string>
  pastorId: string
}): Promise<ChurchPastorSummary | null> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return null
  const row = await db.churchPastor.findFirst({
    where: { church_id: { in: ids }, pastor_id: pastorId },
    include: { pastor: { select: { name: true, introduction: true } } },
  })
  return row ? mapChRow(row) : null
}

/** READY image asset belonging to this church (pastor image ownership check). */
export const GET_CHURCH_READY_IMAGE = async ({
  churchIds,
  assetId,
}: {
  churchIds: Set<string>
  assetId: string
}): Promise<{ id: string } | null> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return null
  return db.mediaAsset.findFirst({
    where: { id: assetId, church_id: { in: ids }, status: 'READY', purpose: 'IMAGE' },
    select: { id: true },
  })
}

export const UPDATE_CHURCH_PASTOR = async ({
  churchIds,
  pastorId,
  expectedVersion,
  pastoralRole,
  imageAssetId,
  requestId,
  actorId,
}: {
  churchIds: Set<string>
  pastorId: string
  expectedVersion: number
  pastoralRole?: string
  imageAssetId?: string | null
  requestId: string
  actorId?: string | null
}): Promise<ChurchPastorSummary> => {
  const ids = Array.from(churchIds)
  const churchId = ids[0]
  if (ids.length === 0)
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })

  return db
    .$transaction(async (tx) => {
      const updated = await tx.church.updateMany({
        where: { id: churchId, version: expectedVersion },
        data: { version: { increment: 1 }, updated_at: new Date() },
      })
      if (updated.count === 0) {
        throw new GeneralError({
          code: 409,
          error: 'CONFLICT',
          error_code: 'STALE_VERSION',
          details: 'This church has changed. Refresh and try again.',
        })
      }
      const fields: Prisma.ChurchPastorUncheckedUpdateInput = {}
      if (pastoralRole !== undefined) fields.pastoral_role = pastoralRole
      if (imageAssetId !== undefined) fields.image_asset_id = imageAssetId
      const row = await tx.churchPastor.update({
        where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorId } },
        data: fields,
        include: { pastor: { select: { name: true, introduction: true } } },
      })
      await tx.auditLog.create({
        data: auditPayload({
          actorId,
          churchId,
          action: 'church.pastor.update',
          resourceType: 'church_pastor',
          resourceId: `${churchId}:${pastorId}`,
          outcome: 'success',
          requestId,
        }),
      })
      return mapChRow(row)
    })
    .catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new GeneralError({
          code: 404,
          error: 'NOT_FOUND',
          error_code: 'RESOURCE_NOT_FOUND',
          details: 'Pastor assignment not found.',
        })
      }
      throw e
    })
}
