import { AccessControl } from 'accesscontrol'
import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { requiredScope } from '@/utils/required-scope'
import { TransformRolesToAccessControl } from '@/utils/role-to-access-control'
import { GET_USER_SCOPE_DATA } from '@/providers/scope'
import { hasPrivateGrant } from '@/controller/request'
import {
  GET_AVAILABLE_LANGUAGE_CODES,
  GET_CHURCHES,
  GET_CHURCH_OVERVIEW,
  GET_CHURCH_PROFILE,
  GET_CHURCH_VERSION,
  GET_CHURCH_READY_IMAGE,
  GET_REQUEST_OVERVIEW,
  UPDATE_CHURCH_PROFILE,
} from '@/providers/church'
import {
  ChurchListQuery,
  ChurchOverview,
  ChurchProfileInput,
  ChurchProfileOutput,
} from '@/models/church'

/*
 * Church controller (Tasks 12/13). Routes authenticate + resolve the primary
 * scope; this controller owns the remaining authorization decisions (list
 * scope union, optional request-section grant) and all business validation.
 * Providers receive the resolved `churchIds` filter for both count and rows.
 */

const allGrants = (
  ac: AccessControl,
  roleName: string,
  subject: string,
  action: string,
): boolean => {
  const q = ac.can(roleName) as unknown as Record<string, (s: string) => { granted: boolean }>
  const anyKey = `${action}Any`
  const ownKey = `${action}Own`
  return Boolean(q[anyKey]?.(subject)?.granted || q[ownKey]?.(subject)?.granted)
}

/**
 * List-scope resolution (SPEC §3.5): the union of descendant CHURCH nodes of
 * every active assignment that grants `action` on `subject`. requiredScope
 * only resolves a single target node, so the list endpoint resolves the union
 * over all covering assignments itself. Returns a Set of church IDs.
 */
export const resolveListScope = async ({
  userId,
  subject,
  action,
}: {
  userId: string
  subject: string
  action: string
}): Promise<Set<string>> => {
  const scopeData = await GET_USER_SCOPE_DATA({ userId })
  const ac = new AccessControl(TransformRolesToAccessControl({ roles: scopeData.roles }))

  const children = new Map<string, string[]>()
  for (const n of scopeData._orgNodes) {
    if (n.parent_id) {
      const list = children.get(n.parent_id) ?? []
      list.push(n.id)
      children.set(n.parent_id, list)
    }
  }
  const nodeKind = new Map(scopeData._orgNodes.map((n) => [n.id, n.kind]))
  const subtree = (root: string): Set<string> => {
    const out = new Set<string>()
    const stack = [root]
    while (stack.length) {
      const cur = stack.pop()!
      if (out.has(cur)) continue
      out.add(cur)
      children.get(cur)?.forEach((c) => stack.push(c))
    }
    return out
  }

  const covering = scopeData.assignments.filter((a) => allGrants(ac, a.role_name, subject, action))
  const churchNodeIds = new Set<string>()
  for (const a of covering) {
    for (const n of Array.from(subtree(a.org_node_id))) {
      if (nodeKind.get(n) === 'CHURCH') churchNodeIds.add(n)
    }
  }
  const result = new Set<string>()
  if (churchNodeIds.size === 0) return result
  const rows = await db.church.findMany({
    where: { org_node_id: { in: Array.from(churchNodeIds) } },
    select: { id: true },
  })
  rows.forEach((r) => result.add(r.id))
  return result
}

/** GET /api/v1/admin/churches — paginated assigned-church list. */
export const listChurches = async ({
  userId,
  query,
}: {
  userId: string
  query: ChurchListQuery
}): Promise<{ result: ChurchProfileOutput[]; total: number }> => {
  const churchIds = await resolveListScope({ userId, subject: 'prayer_church', action: 'read' })
  if (churchIds.size === 0) return { result: [], total: 0 }
  return GET_CHURCHES({ churchIds, query })
}

/** GET /api/v1/admin/churches/:churchId/overview. */
export const getChurchOverview = async ({
  userId,
  churchId,
  churchIds,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
}): Promise<ChurchOverview> => {
  const overview = await GET_CHURCH_OVERVIEW({ churchId, churchIds })
  if (!overview || !churchIds.has(churchId)) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  // Optional request section: only when the caller also holds request read.
  let hasRequestAccess = false
  try {
    await requiredScope({ userId, churchId, subject: 'prayer_request', action: 'read' })
    hasRequestAccess = true
  } catch {
    hasRequestAccess = false
  }
  if (hasRequestAccess) {
    const canReadPrivate = await hasPrivateGrant({ userId, churchId })
    const requests = await GET_REQUEST_OVERVIEW({ churchId, canReadPrivate, take: 5 })
    overview.requests = requests
  }
  return overview
}

/** GET /api/v1/admin/churches/:churchId/profile. */
export const getChurchProfile = async ({
  churchId,
  churchIds,
}: {
  churchId: string
  churchIds: Set<string>
}): Promise<ChurchProfileOutput> => {
  const profile = await GET_CHURCH_PROFILE({ churchId, churchIds })
  if (!profile) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Church not found.',
    })
  }
  return profile
}

/** PATCH /api/v1/admin/churches/:churchId/profile. */
export const patchChurchProfile = async ({
  userId,
  churchId,
  churchIds,
  input,
  requestId,
}: {
  userId: string
  churchId: string
  churchIds: Set<string>
  input: ChurchProfileInput
  requestId: string
}): Promise<ChurchProfileOutput> => {
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

  // Owned languages: every requested code must exist and be enabled.
  const validLanguages = await GET_AVAILABLE_LANGUAGE_CODES({ codes: input.languageCodes })
  const missing = input.languageCodes.filter((c) => !validLanguages.has(c))
  if (missing.length > 0) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'UNKNOWN_LANGUAGE',
      details: `Unknown or disabled language: ${missing.join(', ')}.`,
      fields: { languageCodes: `Unknown or disabled: ${missing.join(', ')}` },
    })
  }

  // Owned cover asset: must belong to this church and be READY (IMAGE).
  let coverAssetId: string | null = null
  if (input.coverAssetId) {
    const asset = await GET_CHURCH_READY_IMAGE({ churchIds, assetId: input.coverAssetId })
    if (!asset) {
      throw new GeneralError({
        code: 422,
        error: 'VALIDATION_ERROR',
        error_code: 'INVALID_COVER_ASSET',
        details: 'coverAssetId must be a ready image owned by this church.',
        fields: { coverAssetId: 'Not a ready image of this church.' },
      })
    }
    coverAssetId = input.coverAssetId
  }

  if (input.galleryItems?.length) {
    for (const item of input.galleryItems) {
      const asset = await GET_CHURCH_READY_IMAGE({ churchIds, assetId: item.mediaAssetId })
      if (!asset) {
        throw new GeneralError({
          code: 422,
          error: 'VALIDATION_ERROR',
          error_code: 'INVALID_GALLERY_ASSET',
          details: `Gallery asset ${item.mediaAssetId} must be a ready image owned by this church.`,
          fields: { galleryItems: 'Contains asset not owned by this church or not ready.' },
        })
      }
    }
  }
  const payload: Prisma.ChurchUncheckedUpdateInput = {
    name: input.name,
    description: input.description ?? null,
    denomination: input.denomination ?? null,
    church_style: input.churchStyle ?? null,
    address: input.address,
    latitude: input.coordinates ? input.coordinates.latitude : null,
    longitude: input.coordinates ? input.coordinates.longitude : null,
    timezone: input.timezone,
    contacts: input.contacts,
    website: input.website || null,
    social_links: input.socialLinks,
    accessibility: input.accessibility ?? null,
    sanctuary_hours: input.sanctuaryHours ?? null,
    diaconal_programs:
      input.diaconalPrograms !== undefined
        ? input.diaconalPrograms === null
          ? Prisma.JsonNull
          : (input.diaconalPrograms as unknown as Prisma.InputJsonValue)
        : undefined,
    cover_asset_id: coverAssetId,
  }

  return UPDATE_CHURCH_PROFILE({
    churchId,
    churchIds,
    expectedVersion: input.version,
    payload,
    languageCodes: input.languageCodes,
    galleryItems: input.galleryItems,
    requestId,
    actorId: userId,
  })
}
