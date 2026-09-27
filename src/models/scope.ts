import { RoleDataModel } from '@/models/role'

export type ScopeKind = 'global' | 'country' | 'diocese' | 'deanery' | 'church'

export interface AccessScope {
  kind: ScopeKind
  orgNodeId: string
  name: string
}

export interface RequiredScopeResult {
  userId: string
  churchIds: Set<string>
  scope: AccessScope
}

/** Parameters for a scope-guarded call. Exactly one of churchId/regionId/central. */
export interface ScopeRequest {
  userId: string
  churchId?: string
  regionId?: string
  central?: boolean
  subject: string
  action: string
  /** Require the granting assignment to be scoped directly to the church node. */
  churchLocalGrant?: boolean
}

export interface ActiveAssignment {
  role_id: string
  role_name: string
  org_node_id: string
}

export interface ResolvedUserScope {
  assignments: ActiveAssignment[]
  /** full role rows including permissions, for accesscontrol grant building */
  roles: RoleDataModel[]
  /** org subtree ancestry: nodeId -> ancestor node ids (parent, grandparent, ...) */
  ancestors: Map<string, string[]>
  /** full org node table; kind is the DB enum */
  _orgNodes: Array<{ id: string; parent_id: string | null; kind: string }>
}
