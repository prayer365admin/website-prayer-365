import { AccessScope } from '@/models/scope'

/* Safe identity + accessible scopes for GET /api/v1/admin/me (SPEC §8.2). */
export interface MeResult {
  id: string
  email: string
  name: string
  scopes: AccessScope[]
}

export interface MeInput {
  user_id: string
}
