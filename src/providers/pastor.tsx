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

const pastorInclude = {
  user: { select: { id: true, name: true, email: true } },
  image_asset: { select: { id: true, church_id: true } },
  churchPastors: {
    include: {
      church: { select: { id: true, name: true } },
    },
  },
} as const

type PastorWithRelations = Prisma.PastorGetPayload<{ include: typeof pastorInclude }>

const mapPastor = (row: PastorWithRelations) => ({
  id: row.id,
  version: row.version,
  user_id: row.user_id,
  name: row.name,
  introduction: row.introduction,
  imageAssetId: row.image_asset_id,
  imageChurchId: row.image_asset?.church_id ?? null,
  user: row.user,
  churches: row.churchPastors.map((assignment) => ({
    churchId: assignment.church.id,
    churchName: assignment.church.name,
  })),
})

export const GET_PASTORS = async ({
  page,
  limit,
  order_by,
  order_direction,
  search,
  assignment,
  staff_assignment,
  church_id,
  user_id,
}: {
  page: number
  limit: number
  order_by: 'name' | 'introduction' | 'staff_account' | 'churches'
  order_direction: 'asc' | 'desc'
  search?: string
  assignment?: 'assigned' | 'unassigned'
  staff_assignment?: 'assigned' | 'unassigned'
  church_id?: string
  user_id?: string
}) => {
  const term = search?.trim()
  const where: Prisma.PastorWhereInput = {
    deleted_at: null,
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { introduction: { contains: term, mode: 'insensitive' } },
            { user: { is: { name: { contains: term, mode: 'insensitive' } } } },
            { user: { is: { email: { contains: term, mode: 'insensitive' } } } },
            {
              churchPastors: {
                some: { church: { name: { contains: term, mode: 'insensitive' } } },
              },
            },
          ],
        }
      : {}),
    ...(assignment === 'assigned'
      ? { churchPastors: { some: {} } }
      : assignment === 'unassigned'
        ? { churchPastors: { none: {} } }
        : {}),
    ...(staff_assignment === 'assigned'
      ? { user_id: { not: null } }
      : staff_assignment === 'unassigned'
        ? { user_id: null }
        : {}),
    ...(church_id ? { churchPastors: { some: { church_id } } } : {}),
    ...(user_id ? { user_id } : {}),
  }
  const [total, rows] = await db.$transaction([
    db.pastor.count({ where }),
    db.pastor.findMany({ where, include: pastorInclude }),
  ])
  const result = rows.map(mapPastor).sort((left, right) => {
    const value = (pastor: ReturnType<typeof mapPastor>) => {
      if (order_by === 'staff_account') return pastor.user?.name || pastor.user?.email || ''
      if (order_by === 'churches')
        return pastor.churches.map((church) => church.churchName).join(', ')
      return pastor[order_by]
    }
    return (
      String(value(left) ?? '').localeCompare(String(value(right) ?? ''), undefined, {
        sensitivity: 'base',
      }) * (order_direction === 'asc' ? 1 : -1)
    )
  })
  return { total, result: result.slice((page - 1) * limit, page * limit) }
}

export const GET_PASTOR_BY_ID = async ({ pastorId }: { pastorId: string }) =>
  db.pastor
    .findUnique({
      where: { id: pastorId, deleted_at: null },
      include: pastorInclude,
    })
    .then((row) => (row ? mapPastor(row) : null))

export const GET_PASTOR_USAGE = async (
  { pastorId }: { pastorId: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.pastor.findUnique({
    where: { id: pastorId },
    select: {
      id: true,
      _count: {
        select: {
          churchPastors: true,
          prayerVersions: true,
          voiceProfiles: true,
          consents: true,
        },
      },
    },
  })

export const DELETE_PASTOR = async (
  { pastorId }: { pastorId: string },
  tx: Prisma.TransactionClient = db,
) => tx.pastor.update({ where: { id: pastorId }, data: { deleted_at: new Date() } })

export const GET_PASTOR_BY_USER_ID = async ({ userId }: { userId: string }) =>
  db.pastor.findFirst({ where: { user_id: userId, deleted_at: null } })

export const GET_USER_BY_ID = async ({ userId }: { userId: string }) =>
  db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } })

export const CREATE_PASTOR = async (
  payload: Prisma.PastorUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.pastor.create({ data: payload })

export const UPDATE_PASTOR = async (
  {
    pastorId,
    expectedVersion,
    payload,
  }: {
    pastorId: string
    expectedVersion: number
    payload: Prisma.PastorUncheckedUpdateInput
  },
  tx: Prisma.TransactionClient = db,
) => {
  const updated = await tx.pastor.updateMany({
    where: { id: pastorId, deleted_at: null, version: expectedVersion },
    data: { ...payload, version: { increment: 1 } },
  })
  if (updated.count === 0) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'STALE_VERSION',
      details: 'This pastor profile has changed. Refresh and try again.',
    })
  }
  const row = await tx.pastor.findUnique({ where: { id: pastorId }, include: pastorInclude })
  if (!row) throw new Error('Updated pastor profile could not be loaded.')
  return mapPastor(row)
}

export const GET_CHURCH_BY_ID = async ({ churchId }: { churchId: string }) =>
  db.church.findUnique({ where: { id: churchId }, select: { id: true, org_node_id: true } })

export const GET_ASSIGNABLE_PASTOR_IMAGE = async (
  { churchId, assetId }: { churchId: string; assetId: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.mediaAsset.findFirst({
    where: {
      id: assetId,
      status: 'READY',
      purpose: 'IMAGE',
      OR: [{ church_id: churchId }, { church_id: null }],
    },
    select: { id: true },
  })

export const GET_ASSIGNABLE_PROFILE_IMAGE = async (
  { pastorId, assetId }: { pastorId: string; assetId: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.mediaAsset.findFirst({
    where: {
      id: assetId,
      status: 'READY',
      purpose: 'IMAGE',
      OR: [
        { church: { pastors: { some: { pastor_id: pastorId } } } },
        // General asset: church-less, attachable to any pastor.
        { church_id: null },
      ],
    },
    select: { id: true, church_id: true },
  })

export const GET_ASSIGNABLE_VOICE_PROFILE = async (
  { voiceProfileId }: { voiceProfileId: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.voiceProfile.findUnique({
    where: { id: voiceProfileId },
    select: {
      id: true,
      church_id: true,
      pastor_id: true,
      review_state: true,
      registration_state: true,
      consent: {
        select: { pastor_id: true, purpose: true, revoked_at: true },
      },
    },
  })

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
    pastoralRole?: string
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
      pastoral_role: pastoralRole ?? 'Pastor',
      image_asset_id: imageAssetId ?? null,
      active_voice_profile_id: activeVoiceProfileId ?? null,
    },
    update: {
      pastoral_role: pastoralRole ?? 'Pastor',
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

export const DELETE_CHURCH_PASTOR = async (
  { churchId, pastorId }: { churchId: string; pastorId: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.churchPastor.delete({
    where: { church_id_pastor_id: { church_id: churchId, pastor_id: pastorId } },
  })

// ============================================================================
// Task 15 — church-scoped pastor reads and assignment patch
// ============================================================================

const mapChRow = (r: {
  church_id: string
  pastor_id: string
  pastoral_role: string
  image_asset_id: string | null
  active_voice_profile_id: string | null
  pastor: {
    name: string
    introduction: string | null
    image_asset_id: string | null
    user: { id: string; name: string; email: string } | null
  }
  active_voice_profile: {
    review_state: string
    registration_state: string
    consent: { revoked_at: Date | null } | null
  } | null
}): ChurchPastorSummary => ({
  id: r.pastor_id,
  name: r.pastor.name,
  introduction: r.pastor.introduction,
  user: r.pastor.user,
  pastoralRole: r.pastoral_role,
  imageAssetId: r.image_asset_id,
  activeVoiceProfileId: r.active_voice_profile_id,
  voiceReady: !!(
    r.active_voice_profile &&
    r.active_voice_profile.review_state === 'APPROVED' &&
    r.active_voice_profile.registration_state === 'READY' &&
    !r.active_voice_profile.consent?.revoked_at
  ),
  profileImageAssetId: r.pastor.image_asset_id,
  resolvedImageAssetId: r.image_asset_id ?? r.pastor.image_asset_id,
})

const churchPastorInclude = {
  pastor: {
    select: {
      name: true,
      introduction: true,
      image_asset_id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  active_voice_profile: {
    select: {
      review_state: true,
      registration_state: true,
      consent: { select: { revoked_at: true } },
    },
  },
} as const

export const GET_CHURCH_PASTORS = async ({
  churchIds,
}: {
  churchIds: Set<string>
}): Promise<ChurchPastorSummary[]> => {
  const ids = Array.from(churchIds)
  if (ids.length === 0) return []
  const rows = await db.churchPastor.findMany({
    where: { church_id: { in: ids } },
    include: churchPastorInclude,
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
    include: churchPastorInclude,
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
        include: churchPastorInclude,
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
