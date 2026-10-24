import { AccessControl } from 'accesscontrol'
import { db } from '@/utils/db-connection'
import { GeneralError } from '@/utils/general-error'
import { GET_USER_SCOPE_DATA } from '@/providers/scope'
import { TransformRolesToAccessControl } from '@/utils/role-to-access-control'
import { ScopeRequest, RequiredScopeResult } from '@/models/scope'

/*
 * Scope guard (SPEC §3.5 / §3.6 step 4).
 *
 * Authorization is NOT a single session role. It resolves the caller's active
 * role_assignments, verifies (a) at least one assignment grants `action` on
 * `subject` (via accesscontrol) and (b) that assignment's org node covers the
 * requested scope, then returns the set of church IDs the caller may operate
 * on within that scope. Providers must use the returned filter for BOTH count
 * and row queries.
 */

type Method = 'read' | 'create' | 'update' | 'delete'

const methodKey = (action: Method, own: boolean) => `${action}${own ? 'Own' : 'Any'}` as const

type QueryMethod = (subject: string) => { granted: boolean }

const anyRoleGrants = (
  ac: AccessControl,
  roleName: string,
  subject: string,
  action: Method,
): boolean => {
  const q = ac.can(roleName) as unknown as Record<string, QueryMethod>
  return Boolean(
    q[methodKey(action, false)](subject).granted || q[methodKey(action, true)](subject).granted,
  )
}

export const requiredScope = async ({
  userId,
  churchId,
  regionId,
  central,
  subject,
  action,
  churchLocalGrant = false,
}: ScopeRequest): Promise<RequiredScopeResult> => {
  const modes = [
    churchId ? 'church' : null,
    regionId ? 'region' : null,
    central ? 'central' : null,
  ].filter(Boolean)
  if (modes.length !== 1) {
    throw new GeneralError({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'SCOPE_AMBIGUOUS',
      details: 'Provide exactly one of churchId, regionId, or central.',
    })
  }

  let targetNodeId: string | null = null

  if (churchId) {
    const church = await db.church.findUnique({
      where: { id: churchId },
      select: { org_node_id: true },
    })
    if (!church) {
      throw new GeneralError({
        code: 404,
        error: 'NOT_FOUND',
        error_code: 'RESOURCE_NOT_FOUND',
        details: 'Resource not found.',
      })
    }
    targetNodeId = church.org_node_id
  } else if (regionId) {
    targetNodeId = regionId
  } else if (central) {
    const root = await db.orgNode.findFirst({ where: { parent_id: null }, select: { id: true } })
    if (!root) {
      throw new GeneralError({
        code: 500,
        error: 'INTERNAL_ERROR',
        error_code: 'NO_GLOBAL_ROOT',
        details: 'Global org root missing.',
      })
    }
    targetNodeId = root.id
  }

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

  const isAncestorOf = (anc: string, target: string) =>
    (scopeData.ancestors.get(target) ?? []).includes(anc)

  // Assignments granting the action on the subject.
  const granting = scopeData.assignments.filter((a) =>
    anyRoleGrants(ac, a.role_name, subject, action as Method),
  )

  // Among grants, which cover the target node (ancestor-or-self)?
  const covering = granting.filter((a) =>
    targetNodeId ? isAncestorOf(a.org_node_id, targetNodeId) : true,
  )

  if (covering.length === 0) {
    throw new GeneralError({
      code: 403,
      error: 'UNAUTHORIZED',
      error_code: 'NOT_ALLOWED',
      details: 'This account is not allowed for this action.',
    })
  }

  // Sensitive grant: church-local subject requires the grant DIRECTLY at the church node.
  // A GLOBAL assignment counts as church-local (plan 023): the only roles that carry
  // a church-local subject are the super admin (`administrator`, every permission row)
  // and the dedicated reader role, and a platform admin must not be able to see LESS
  // than a church-level reader.
  if (churchLocalGrant && churchId) {
    const nodeRow = await db.church.findUnique({
      where: { id: churchId },
      select: { org_node_id: true },
    })
    const ok =
      nodeRow &&
      covering.some(
        (a) => a.org_node_id === nodeRow.org_node_id || nodeKind.get(a.org_node_id) === 'GLOBAL',
      )
    if (!ok) {
      throw new GeneralError({
        code: 403,
        error: 'UNAUTHORIZED',
        error_code: 'NOT_ALLOWED',
        details: 'Sensitive data requires a church-local grant.',
      })
    }
  }

  // Church filter: descendant CHURCH nodes of all covering assignments.
  let churchNodeIds = new Set<string>()
  for (const a of covering) {
    for (const n of Array.from(subtree(a.org_node_id))) {
      if (nodeKind.get(n) === 'CHURCH') churchNodeIds.add(n)
    }
  }

  if (regionId) {
    const regionSub = subtree(regionId)
    for (const n of Array.from(churchNodeIds)) {
      if (!regionSub.has(n)) churchNodeIds.delete(n)
    }
  } else if (targetNodeId && churchId) {
    churchNodeIds = nodeKind.get(targetNodeId) === 'CHURCH' ? new Set([targetNodeId]) : new Set()
  }

  const churches =
    churchNodeIds.size > 0
      ? await db.church.findMany({
          where: { org_node_id: { in: Array.from(churchNodeIds) } },
          select: { id: true },
        })
      : []

  const nodeRow = nodeKind.get(targetNodeId!)
  const kindMap: Record<string, RequiredScopeResult['scope']['kind']> = {
    GLOBAL: 'global',
    COUNTRY: 'country',
    DIOCESE: 'diocese',
    DEANERY: 'deanery',
    CHURCH: 'church',
  }

  return {
    userId,
    churchIds: new Set(churches.map((c) => c.id)),
    scope: {
      kind: kindMap[nodeRow ?? ''] ?? 'global',
      orgNodeId: targetNodeId!,
      name: '',
    },
  }
}
