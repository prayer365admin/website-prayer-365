import { Prisma, User } from '@prisma/client'
import { GeneralOmitModel } from './general-omit'
import { RoleDataModel } from './role'

export interface UserDataModel extends User {
  role: RoleDataModel | null
}

export interface UserPayloadCreateModel extends Prisma.UserUncheckedCreateInput {}

export interface UserPayloadUpdateModel
  extends Omit<Prisma.UserUncheckedUpdateInput, GeneralOmitModel | 'role'> {}

export interface UserFormModel extends Omit<UserDataModel, GeneralOmitModel | 'password' | 'role'> {
  password?: string | null
}
