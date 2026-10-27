import { OrgNode, Prisma, User } from '@prisma/client'
import { GeneralOmitModel } from './general-omit'
import { RoleDataModel } from './role'

export interface UserDataModel extends User {
  role: RoleDataModel | null
  role_assignments?: Array<{ org_node: Pick<OrgNode, 'kind' | 'name'> }>
  roleAssignments?: Array<{ org_node: Pick<OrgNode, 'kind' | 'name'> }>
}

export interface UserPayloadCreateModel extends Prisma.UserUncheckedCreateInput {}

export interface UserPayloadUpdateModel extends Omit<
  Prisma.UserUncheckedUpdateInput,
  GeneralOmitModel | 'role'
> {}

export interface UserFormModel extends Omit<
  UserDataModel,
  GeneralOmitModel | 'password' | 'role' | 'role_assignments' | 'roleAssignments'
> {
  password?: string | null
}
