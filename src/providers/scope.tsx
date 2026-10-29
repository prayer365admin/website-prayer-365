import { db } from '@/utils/db-connection'
import { ResolvedUserScope, ScopeKind } from '@/models/scope'

/*
 * Scope resolution data source (SPEC §3.5). Pure DB read — no authorization
 * decisions here. The guard (utils/required-scope.ts) decides.
 */

export interface OrgNodeRow {
  id: string
  parent_id: string | null
  kind: 'GLOBAL' | 'COUNTRY' | 'DIOCESE' | 'DEANERY' | 'CHURCH'
}

/**
 * Load a user's active role assignments (revoked_at null) with role names,
 * plus the full org node table (administrative hierarchy is small) for the
 * guard to derive subtrees/ancestry in memory.
 */
export const GET_USER_SCOPE_DATA = async ({
  userId,
}: {
  userId: string
}): Promise<ResolvedUserScope> => {
  const assignments = await db.roleAssignment.findMany({
    where: { user_id: userId, revoked_at: null },
    include: { role: { include: { permission: true } } },
  })

  const nodes = await db.orgNode.findMany()

  const ancestors = new Map<string, string[]>()
  const idToParent = new Map<string, string | null>(nodes.map((n) => [n.id, n.parent_id]))
  for (const n of nodes) {
    const chain: string[] = []
    let cur: string | null = n.id
    while (cur) {
      chain.push(cur)
      cur = idToParent.get(cur) ?? null
    }
    ancestors.set(n.id, chain)
  }

  return {
    assignments: assignments.map((a) => ({
      role_id: a.role_id,
      role_name: a.role.name,
      org_node_id: a.org_node_id,
    })),
    roles: assignments.map((a) => a.role),
    ancestors,
    _orgNodes: nodes as OrgNodeRow[],
  }
}

/**
 * The single GLOBAL org node (hierarchy root). Used when a super admin needs the
 * tenancy layer: requiredScope authorizes from role_assignments, so an
 * administrator holding only the identity role sees every church list empty.
 */
export const GET_GLOBAL_ORG_NODE = async (): Promise<{ id: string } | null> =>
  db.orgNode.findFirst({ where: { kind: 'GLOBAL' }, select: { id: true } })

/**
 * Resolve the target org node for an /admin/access query. Exactly ONE of
 * churchId/regionId must be present (the controller enforces). Returns the
 * target node's id/kind/name, or null when the referenced entity is unknown.
 */
export const RESOLVE_SCOPE_TARGET = async ({
  churchId,
  regionId,
}: {
  churchId?: string
  regionId?: string
}): Promise<{ orgNodeId: string; kind: OrgNodeRow['kind']; name: string } | null> => {
  if (churchId) {
    const church = await db.church.findUnique({
      where: { id: churchId },
      select: { org_node: { select: { id: true, kind: true, name: true } } },
    })
    if (!church) return null
    return {
      orgNodeId: church.org_node.id,
      kind: church.org_node.kind,
      name: church.org_node.name,
    }
  }

  if (regionId) {
    const node = await db.orgNode.findUnique({
      where: { id: regionId },
      select: { id: true, kind: true, name: true },
    })
    if (!node) return null
    return { orgNodeId: node.id, kind: node.kind, name: node.name }
  }

  return null
}

const KIND_MAP: Record<OrgNodeRow['kind'], ScopeKind> = {
  GLOBAL: 'global',
  COUNTRY: 'country',
  DIOCESE: 'diocese',
  DEANERY: 'deanery',
  CHURCH: 'church',
}

export const scopeKind = (kind: OrgNodeRow['kind']): ScopeKind => KIND_MAP[kind] ?? 'global'
