import { Permission, Prisma, Role } from '@prisma/client'
import { GeneralOmitModel } from './general-omit'

export interface RoleDataModel extends Role {
  permission: Permission[]
}

export interface RolePayloadCrateModel extends Omit<Prisma.RoleUncheckedCreateInput, 'permission'> {
  permission_list?: { [key: string]: boolean }
}
export interface RolePayloadUpdateModel
  extends Omit<Prisma.RoleUncheckedUpdateInput, 'permission'> {
  permission_list: { [key: string]: boolean }
}

export interface RoleFormModel extends Omit<RoleDataModel, GeneralOmitModel | 'permission'> {
  permission_list: { [key: string]: boolean }
}
