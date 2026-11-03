import { ChurchStatus } from '@prisma/client'
import {
  ChurchCreate,
  ChurchDetail,
  ChurchSummary,
  ChurchPurge,
  ChurchUpdate,
} from '@/models/central-church'
import {
  COUNT_CHURCH_DEPENDENTS,
  CREATE_CHURCH,
  CREATE_ORG_NODE,
  DELETE_CHURCH_ROW,
  DELETE_ORG_NODE_ROW,
  GET_CHURCHES,
  GET_CHURCH_BY_ID,
  GET_ORG_NODE_BY_ID,
  GET_ORG_NODE_MAP,
  UPDATE_CHURCH,
  UPDATE_CHURCH_STATUS,
  churchOrgPath,
} from '@/providers/central-church'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'

/*
 * Central church business logic (SPEC §8.3 / Tasks 17-18). Creation writes an
 * OrgNode (CHURCH) + a PENDING Church in ONE transaction. Lifecycle approve /
 * suspend / archive carry a version, are audited, and never hard-delete.
 * `purgeChurch` is the single exception (plan 020 D-A): a PENDING church with
 * zero dependent rows only.
 */

const notFound = (error_code = 'CHURCH_NOT_FOUND') =>
  new GeneralError({ code: 404, error: 'NOT_FOUND', error_code, details: 'Resource not found.' })

const stale = () =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: 'The resource was modified concurrently; reload and retry.',
  })

export const listChurches = async ({
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
}) => GET_CHURCHES({ page, limit, order_direction, status, search })

export const getChurch = async ({ churchId }: { churchId: string }) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  const nodes = await GET_ORG_NODE_MAP()
  const path = churchOrgPath(nodes, church.org_node_id)
  const detail: ChurchDetail = {
    id: church.id,
    orgNodeId: church.org_node_id,
    name: church.name,
    status: church.status,
    timezone: church.timezone,
    description: church.description,
    denomination: church.denomination,
    church_style: church.church_style,
    latitude: church.latitude === null ? null : Number(church.latitude),
    longitude: church.longitude === null ? null : Number(church.longitude),
    sunday_live_stream: church.sunday_live_stream,
    taize_chants: church.taize_chants,
    youth_ministry: church.youth_ministry,
    ...path,
    approvedAt: church.approved_at?.toISOString() ?? null,
    version: church.version,
    createdAt: church.created_at.toISOString(),
  }
  return detail
}

export const createChurch = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: ChurchCreate
  actorId: string
  requestId: string
}) => {
  if (payload.parentId) {
    const parent = await GET_ORG_NODE_BY_ID({ orgNodeId: payload.parentId })
    if (!parent) throw notFound('PARENT_NODE_NOT_FOUND')
    if (parent.kind === 'CHURCH' || parent.kind === 'GLOBAL') {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_PARENT_KIND',
        details: 'A church must be placed under a country, diocese, or deanery node.',
      })
    }
  }

  const church = await dbTransaction(async (tx) => {
    const node = await CREATE_ORG_NODE(
      { kind: 'CHURCH', name: payload.name, parentId: payload.parentId },
      tx,
    )
    const created = await CREATE_CHURCH(
      {
        orgNodeId: node.id,
        name: payload.name,
        timezone: payload.timezone,
        description: payload.description,
        denomination: payload.denomination,
        church_style: payload.church_style,
        address: payload.address,
        contacts: payload.contacts,
        latitude: payload.latitude,
        longitude: payload.longitude,
        sunday_live_stream: payload.sunday_live_stream,
        taize_chants: payload.taize_chants,
        youth_ministry: payload.youth_ministry,
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.create',
        resourceType: 'church',
        resourceId: created.id,
        outcome: 'success',
        requestId,
      }),
    })
    return created
  })

  const summary: ChurchSummary = {
    id: church.id,
    orgNodeId: church.org_node_id,
    name: church.name,
    status: church.status,
    timezone: church.timezone,
    description: church.description,
    denomination: church.denomination,
    church_style: church.church_style,
    version: church.version,
    createdAt: church.created_at.toISOString(),
  }
  return summary
}

export const updateChurch = async ({
  churchId,
  payload,
  actorId,
  requestId,
}: {
  churchId: string
  payload: ChurchUpdate
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (payload.version !== church.version) throw stale()

  const updated = await dbTransaction(async (tx) => {
    // slug is set once at creation; church renames deliberately do not change the public URL.
    const row = await UPDATE_CHURCH(
      {
        churchId,
        payload: {
          name: payload.name,
          timezone: payload.timezone,
          description: payload.description,
          denomination: payload.denomination,
          church_style: payload.church_style,
          latitude: payload.latitude,
          longitude: payload.longitude,
          sunday_live_stream: payload.sunday_live_stream,
          taize_chants: payload.taize_chants,
          youth_ministry: payload.youth_ministry,
        },
      },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.update',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}

/** Approve requires the version (concurrency) and a minimum validated setup. */
export const approveChurch = async ({
  churchId,
  version,
  actorId,
  requestId,
}: {
  churchId: string
  version: number
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (version !== church.version) throw stale()

  if (church.status === 'APPROVED') return church

  if (!church.name || !church.timezone) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'REQUIRED_SETUP',
      details: 'Name and timezone are required before approval.',
    })
  }

  const updated = await dbTransaction(async (tx) => {
    const row = await UPDATE_CHURCH_STATUS(
      { churchId, status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.approve',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}

const fromStatuses = (
  churchId: string,
  current: ChurchStatus,
  allowed: ChurchStatus[],
  status: ChurchStatus,
) => {
  if (allowed.length && !allowed.includes(current)) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'INVALID_TRANSITION',
      details: `Cannot transition church ${churchId} from '${current}' to '${status}'.`,
    })
  }
}

export const suspendChurch = async ({
  churchId,
  version,
  actorId,
  requestId,
}: {
  churchId: string
  version: number
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (version !== church.version) throw stale()
  fromStatuses(churchId, church.status, ['APPROVED', 'PENDING'], 'SUSPENDED')

  const updated = await dbTransaction(async (tx) => {
    const row = await UPDATE_CHURCH_STATUS({ churchId, status: 'SUSPENDED' }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.suspend',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}
export const unsuspendChurch = async ({
  churchId,
  version,
  actorId,
  requestId,
}: {
  churchId: string
  version: number
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (version !== church.version) throw stale()
  fromStatuses(churchId, church.status, ['SUSPENDED'], 'APPROVED')

  const updated = await dbTransaction(async (tx) => {
    const row = await UPDATE_CHURCH_STATUS(
      { churchId, status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.unsuspend',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}

export const archiveChurch = async ({
  churchId,
  version,
  actorId,
  requestId,
}: {
  churchId: string
  version: number
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (version !== church.version) throw stale()
  if (church.status === 'ARCHIVED') {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'INVALID_TRANSITION',
      details: 'Church is already archived.',
    })
  }

  const updated = await dbTransaction(async (tx) => {
    const row = await UPDATE_CHURCH_STATUS({ churchId, status: 'ARCHIVED' }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.archive',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}

export const unarchiveChurch = async ({
  churchId,
  version,
  actorId,
  requestId,
}: {
  churchId: string
  version: number
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (version !== church.version) throw stale()
  fromStatuses(churchId, church.status, ['ARCHIVED'], 'APPROVED')

  const updated = await dbTransaction(async (tx) => {
    const row = await UPDATE_CHURCH_STATUS(
      { churchId, status: 'APPROVED', approvedBy: actorId, approvedAt: new Date() },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.unarchive',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
  return updated
}

/**
 * Hard delete (purge) — the only destructive path for a church (plan 020 D-A).
 *
 * Guards run in this order, cheapest and most explicit first:
 *   1. not found           → 404 CHURCH_NOT_FOUND
 *   2. version mismatch    → 409 STALE_VERSION
 *   3. not PENDING         → 409 INVALID_TRANSITION (archive instead)
 *   4. name mismatch       → 422 CONFIRMATION_MISMATCH
 *   5. any dependents      → 409 CHURCH_HAS_CONTENT (counts in `fields`)
 *
 * Deleting the Church row and its OrgNode happens in one transaction, so a
 * failure never leaves an orphan node behind. `church.purge` is audited.
 */
export const purgeChurch = async ({
  churchId,
  payload,
  actorId,
  requestId,
}: {
  churchId: string
  payload: ChurchPurge
  actorId: string
  requestId: string
}) => {
  const church = await GET_CHURCH_BY_ID({ churchId })
  if (!church) throw notFound()
  if (payload.version !== church.version) throw stale()

  if (church.status !== 'PENDING') {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'INVALID_TRANSITION',
      details: 'Only a pending church can be deleted. Archive this church instead.',
    })
  }

  if (payload.confirmName.trim() !== church.name.trim()) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'CONFIRMATION_MISMATCH',
      details: 'Type the church name exactly as shown to confirm deletion.',
    })
  }

  const dependents = await COUNT_CHURCH_DEPENDENTS({
    churchId,
    orgNodeId: church.org_node_id,
  })
  const blockers = Object.entries(dependents).filter(([, count]) => count > 0)
  if (blockers.length > 0) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'CHURCH_HAS_CONTENT',
      details:
        'This church still has related records, so it cannot be deleted. Archive it instead.',
      fields: Object.fromEntries(blockers.map(([key, count]) => [key, String(count)])),
    })
  }

  await dbTransaction(async (tx) => {
    await DELETE_CHURCH_ROW({ churchId }, tx)
    await DELETE_ORG_NODE_ROW({ orgNodeId: church.org_node_id }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'church.purge',
        resourceType: 'church',
        resourceId: churchId,
        outcome: 'success',
        requestId,
      }),
    })
  })
}
