import { Prisma } from '@prisma/client'
import {
  ChurchPastorAssign,
  ChurchPastorAssignEntry,
  ChurchPastorPatchInput,
  ChurchPastorSummary,
  PastorCreate,
  PastorUpdate,
} from '@/models/pastor'
import {
  CREATE_PASTOR,
  DELETE_CHURCH_PASTOR,
  DELETE_PASTOR,
  DELETE_CHURCH_PASTORS_NOT_IN,
  GET_CHURCH_BY_ID,
  GET_ASSIGNABLE_PASTOR_IMAGE,
  GET_ASSIGNABLE_VOICE_PROFILE,
  GET_CHURCH_PASTOR,
  GET_CHURCH_PASTORS,
  GET_CHURCH_READY_IMAGE,
  GET_ASSIGNABLE_PROFILE_IMAGE,
  GET_PASTOR_BY_ID,
  GET_PASTOR_BY_USER_ID,
  GET_PASTOR_USAGE,
  GET_PASTORS,
  GET_USER_BY_ID,
  UPDATE_CHURCH_PASTOR,
  UPDATE_PASTOR,
  UPSERT_CHURCH_PASTOR,
} from '@/providers/pastor'
import { GET_CHURCH_VERSION } from '@/providers/church'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'
import { CONSENT_PURPOSE } from '@/providers/voice'

/*
 * Central pastor business logic (SPEC §8.3 / Task 20). Central authority owns
 * the shared profile (name / introduction / linked user). Church assignment
 * replaces the church's pastor links but never deletes Pastor rows, so
 * historical prayer attribution is preserved.
 */

const notFound = (error_code: string) =>
  new GeneralError({ code: 404, error: 'NOT_FOUND', error_code, details: 'Resource not found.' })

export const listPastors = async ({
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
}) =>
  GET_PASTORS({
    page,
    limit,
    order_by,
    order_direction,
    search,
    assignment,
    staff_assignment,
    church_id,
    user_id,
  })

export const getPastor = async ({ pastorId }: { pastorId: string }) => {
  const pastor = await GET_PASTOR_BY_ID({ pastorId })
  if (!pastor) throw notFound('PASTOR_NOT_FOUND')
  return pastor
}

export const createPastor = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: PastorCreate
  actorId: string
  requestId: string
}) => {
  if (payload.userId) {
    const user = await GET_USER_BY_ID({ userId: payload.userId })
    if (!user) throw notFound('USER_NOT_FOUND')
    const existingPastor = await GET_PASTOR_BY_USER_ID({ userId: payload.userId })
    if (existingPastor) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'LINKED_USER_TAKEN',
        details: 'This user is already linked to another pastor profile.',
      })
    }
  }

  return dbTransaction(async (tx) => {
    const row = await CREATE_PASTOR(
      {
        name: payload.name,
        introduction: payload.introduction ?? null,
        user_id: payload.userId ?? null,
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'pastor.create',
        resourceType: 'pastor',
        resourceId: row.id,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const updatePastor = async ({
  pastorId,
  payload,
  actorId,
  requestId,
}: {
  pastorId: string
  payload: PastorUpdate
  actorId: string
  requestId: string
}) => {
  const pastor = await GET_PASTOR_BY_ID({ pastorId })
  if (!pastor) throw notFound('PASTOR_NOT_FOUND')

  if (payload.userId !== undefined && payload.userId !== null) {
    const user = await GET_USER_BY_ID({ userId: payload.userId })
    if (!user) throw notFound('USER_NOT_FOUND')
    const existing = await GET_PASTOR_BY_USER_ID({ userId: payload.userId })
    if (existing && existing.id !== pastorId) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'LINKED_USER_TAKEN',
        details: 'This user is already linked to another pastor profile.',
      })
    }
  }

  if (payload.imageAssetId) {
    const image = await GET_ASSIGNABLE_PROFILE_IMAGE({
      pastorId,
      assetId: payload.imageAssetId,
    })
    if (!image) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_PROFILE_IMAGE',
        details: 'The canonical image must be ready and belong to an assigned church.',
        fields: { imageAssetId: 'Not a ready image from an assigned church.' },
      })
    }
  }

  return dbTransaction(async (tx) => {
    const row = await UPDATE_PASTOR(
      {
        pastorId,
        expectedVersion: payload.version,
        payload: {
          name: payload.name,
          introduction: payload.introduction,
          image_asset_id: payload.imageAssetId,
          user_id: payload.userId,
        },
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'pastor.update',
        resourceType: 'pastor',
        resourceId: pastorId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const deletePastor = async ({
  pastorId,
  actorId,
  requestId,
}: {
  pastorId: string
  actorId: string
  requestId: string
}) => {
  const pastor = await GET_PASTOR_BY_ID({ pastorId })
  if (!pastor) throw notFound('PASTOR_NOT_FOUND')
  return dbTransaction(async (tx) => {
    const usage = await GET_PASTOR_USAGE({ pastorId }, tx)
    if (usage && Object.values(usage._count).some((referenceCount) => referenceCount > 0)) {
      throw new GeneralError({
        code: 409,
        error: 'CONFLICT',
        error_code: 'PASTOR_IN_USE',
        details:
          'A pastor profile with church, prayer, voice, or consent references cannot be deleted.',
      })
    }
    const deleted = await DELETE_PASTOR({ pastorId }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'pastor.delete',
        resourceType: 'pastor',
        resourceId: pastorId,
        outcome: 'success',
        requestId,
      }),
    })
    return deleted
  })
}

const validateCentralAssignment = async ({
  churchId,
  entry,
  activeVoiceProfileId,
  tx,
}: {
  churchId: string
  entry: ChurchPastorAssignEntry
  activeVoiceProfileId: string | null
  tx: Prisma.TransactionClient
}) => {
  if (entry.imageAssetId) {
    const image = await GET_ASSIGNABLE_PASTOR_IMAGE({ churchId, assetId: entry.imageAssetId }, tx)
    if (!image) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_IMAGE_ASSET',
        details: 'imageAssetId must be a ready image owned by this church.',
        fields: { imageAssetId: 'Not a ready image of this church.' },
      })
    }
  }

  if (activeVoiceProfileId) {
    const voice = await GET_ASSIGNABLE_VOICE_PROFILE({ voiceProfileId: activeVoiceProfileId }, tx)
    const consent = voice?.consent
    if (
      !voice ||
      !consent ||
      voice.church_id !== churchId ||
      voice.pastor_id !== entry.pastorId ||
      voice.review_state !== 'APPROVED' ||
      voice.registration_state !== 'READY' ||
      consent.pastor_id !== entry.pastorId ||
      consent.purpose !== CONSENT_PURPOSE ||
      consent.revoked_at !== null
    ) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_ACTIVE_VOICE_PROFILE',
        details:
          'The active voice must be ready, approved, consented, and belong to this pastor and church.',
        fields: { activeVoiceProfileId: 'Voice profile is not eligible for this assignment.' },
      })
    }
  }
}

export const assignPastorToChurch = async ({
  churchId,
  entry,
  actorId,
  requestId,
}: {
  churchId: string
  entry: ChurchPastorAssignEntry
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound('CHURCH_NOT_FOUND')
  const pastor = await GET_PASTOR_BY_ID({ pastorId: entry.pastorId })
  if (!pastor) throw notFound('PASTOR_NOT_FOUND')

  return dbTransaction(async (tx) => {
    await validateCentralAssignment({
      churchId,
      entry,
      activeVoiceProfileId: entry.activeVoiceProfileId ?? null,
      tx,
    })
    const assigned = await UPSERT_CHURCH_PASTOR(
      {
        churchId,
        pastorId: entry.pastorId,
        pastoralRole: entry.pastoralRole,
        imageAssetId: entry.imageAssetId,
        activeVoiceProfileId: entry.activeVoiceProfileId,
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'church_pastor.assign',
        resourceType: 'church_pastor',
        resourceId: churchId + ':' + entry.pastorId,
        outcome: 'success',
        requestId,
      }),
    })
    return assigned
  })
}

export const unassignPastorFromChurch = async ({
  churchId,
  pastorId,
  actorId,
  requestId,
}: {
  churchId: string
  pastorId: string
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound('CHURCH_NOT_FOUND')

  return dbTransaction(async (tx) => {
    const removed = await DELETE_CHURCH_PASTOR({ churchId, pastorId }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        churchId,
        action: 'church_pastor.unassign',
        resourceType: 'church_pastor',
        resourceId: churchId + ':' + pastorId,
        outcome: 'success',
        requestId,
      }),
    })
    return removed
  })
}

export const putChurchPastors = async ({
  churchId,
  payload,
  actorId,
  requestId,
}: {
  churchId: string
  payload: ChurchPastorAssign
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound('CHURCH_NOT_FOUND')

  const pastorIds = payload.assigned.map((a) => a.pastorId)
  for (const pastorId of pastorIds) {
    const pastor = await GET_PASTOR_BY_ID({ pastorId })
    if (!pastor) throw notFound(`PASTOR_NOT_FOUND_${pastorId}`)
  }

  await dbTransaction(async (tx) => {
    for (const entry of payload.assigned) {
      await validateCentralAssignment({
        churchId,
        entry,
        activeVoiceProfileId: entry.activeVoiceProfileId ?? payload.activeVoiceProfileId ?? null,
        tx,
      })
    }
    for (const entry of payload.assigned) {
      const voiceId = entry.activeVoiceProfileId ?? payload.activeVoiceProfileId ?? null
      await UPSERT_CHURCH_PASTOR(
        {
          churchId,
          pastorId: entry.pastorId,
          pastoralRole: entry.pastoralRole,
          imageAssetId: entry.imageAssetId,
          activeVoiceProfileId: voiceId,
        },
        tx,
      )
    }
    await DELETE_CHURCH_PASTORS_NOT_IN({ churchId, pastorIds }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church_pastor.assign',
        resourceType: 'church_pastor',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
  })

  return { churchId, assigned: payload.assigned }
}

// ============================================================================
// Task 15 — church-scoped pastor reads and assignment patch
// ============================================================================

export const getChurchPastors = async ({
  churchIds,
}: {
  churchIds: Set<string>
}): Promise<ChurchPastorSummary[]> => {
  if (churchIds.size === 0) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  return GET_CHURCH_PASTORS({ churchIds })
}

export const getChurchPastor = async ({
  churchIds,
  pastorId,
}: {
  churchIds: Set<string>
  pastorId: string
}): Promise<ChurchPastorSummary> => {
  const row = await GET_CHURCH_PASTOR({ churchIds, pastorId })
  if (!row) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Pastor assignment not found.',
    })
  }
  return row
}

export const patchChurchPastor = async ({
  userId,
  churchId,
  churchIds,
  pastorId,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  pastorId: string
  input: ChurchPastorPatchInput
  requestId: string
}): Promise<ChurchPastorSummary> => {
  if (!churchIds.has(churchId)) {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
      details: 'This account is not allowed for this church.',
    })
  }
  const currentVersion = await GET_CHURCH_VERSION({ churchId, churchIds })
  if (currentVersion === null) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  if (input.version !== currentVersion) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'STALE_VERSION',
      details: 'This church has changed. Refresh and try again.',
    })
  }

  // Only a field that is actually present may change the church image: an
  // omitted image_asset_id must leave the stored override untouched.
  let imageAssetId: string | null | undefined
  if (input.image_asset_id) {
    const asset = await GET_CHURCH_READY_IMAGE({ churchIds, assetId: input.image_asset_id })
    if (!asset) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_IMAGE_ASSET',
        details: 'image_asset_id must be a ready image owned by this church.',
        fields: { image_asset_id: 'Not a ready image of this church.' },
      })
    }
    imageAssetId = input.image_asset_id
  } else if (input.image_asset_id === null) {
    imageAssetId = null
  }

  return UPDATE_CHURCH_PASTOR({
    churchIds,
    pastorId,
    expectedVersion: input.version,
    pastoralRole: input.pastoral_role,
    imageAssetId,
    requestId,
    actorId: userId,
  })
}
