import { ChurchStatus } from '@prisma/client'
import { ChurchCreate, ChurchSummary, ChurchUpdate } from '@/models/central-church'
import {
  CREATE_CHURCH,
  CREATE_ORG_NODE,
  GET_CHURCHES,
  GET_CHURCH_BY_ID,
  GET_ORG_NODE_BY_ID,
  UPDATE_CHURCH,
  UPDATE_CHURCH_STATUS,
} from '@/providers/central-church'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'

/*
 * Central church business logic (SPEC §8.3 / Tasks 17-18). Creation writes an
 * OrgNode (CHURCH) + a PENDING Church in ONE transaction. Lifecycle approve /
 * suspend / archive carry a version, are audited, and never hard-delete.
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
  return church
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
