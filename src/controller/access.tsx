import { GET_USER_SCOPE_DATA, RESOLVE_SCOPE_TARGET, scopeKind } from '@/providers/scope'
import { GeneralError } from '@/utils/general-error'

/*
 * GET /api/v1/admin/access (Task 10).
 *
 * churchId? OR regionId? (exactly one) -> caller's effective
 * { subject: actions[] } permission catalogue for that scope. Uses the same
 * scope-resolution data source as requiredScope (active role assignments +
 * org subtree ancestry) but returns the FULL effective catalogue instead of
 * validating a single action. Unauthorized subjects are omitted from the map.
 */

export interface EffectiveAccessResult {
  scope: { kind: string; orgNodeId: string; name: string }
  subjects: Record<string, string[]>
}

const isAncestorOrSelf = (ancestors: Map<string, string[]>, anc: string, target: string) =>
  (ancestors.get(target) ?? []).includes(anc)

export const getEffectiveAccess = async ({
  userId,
  churchId,
  regionId,
}: {
  userId: string
  churchId?: string
  regionId?: string
}): Promise<EffectiveAccessResult> => {
  const modes = [churchId ? 'church' : null, regionId ? 'region' : null].filter(Boolean)
  if (modes.length !== 1) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'SCOPE_AMBIGUOUS',
      details: 'Provide exactly one of churchId or regionId.',
    })
  }

  const target = await RESOLVE_SCOPE_TARGET({ churchId, regionId })
  if (!target) {
    throw new GeneralError({
      code: 404,
      error: 'NOT_FOUND',
      error_code: 'RESOURCE_NOT_FOUND',
      details: 'Scope not found.',
    })
  }

  const scopeData = await GET_USER_SCOPE_DATA({ userId })

  const roleById = new Map(scopeData.roles.map((r) => [r.id, r]))

  const covering = scopeData.assignments.filter((a) =>
    isAncestorOrSelf(scopeData.ancestors, a.org_node_id, target.orgNodeId),
  )

  if (covering.length === 0) {
    // No active assignment covers the requested scope -> no effective actions.
    return {
      scope: { kind: scopeKind(target.kind), orgNodeId: target.orgNodeId, name: target.name },
      subjects: {},
    }
  }

  // Build subject -> Set of actions.
  const subjectsObject: Record<string, string[]> = {}

  for (const a of covering) {
    const role = roleById.get(a.role_id)
    if (!role) continue

    for (const perm of role.permission) {
      // Sensitive rule (SPEC §3.4): prayer_private_request requires a grant
      // DIRECTLY at the church node. An ancestor-level grant does not carry.
      if (target.kind === 'CHURCH' && perm.subject === 'prayer_private_request') {
        if (a.org_node_id !== target.orgNodeId) continue
      }

      const existing = subjectsObject[perm.subject]
      const set = existing ? new Set(existing) : new Set<string>()
      for (const action of perm.actions.split(',')) {
        if (action) set.add(action.trim())
      }
      subjectsObject[perm.subject] = Array.from(set).sort()
    }
  }

  return {
    scope: { kind: scopeKind(target.kind), orgNodeId: target.orgNodeId, name: target.name },
    subjects: subjectsObject,
  }
}
