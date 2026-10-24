import { Permission, Prisma, Role } from '@prisma/client'
import { z } from 'zod'
import { GeneralOmitModel } from './general-omit'

export interface RoleDataModel extends Role {
  permission: Permission[]
}

/** Permission matrix payload: `{ [permissionId]: true }` for the rows to grant. */
export const RolePermissionListSchema = z.record(z.string(), z.boolean())

export const RolePayloadCrateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  type: z.enum(['SYSTEM', 'USER']).optional(),
  permission_list: RolePermissionListSchema.optional(),
})

export const RolePayloadUpdateSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  type: z.enum(['SYSTEM', 'USER']).optional(),
  permission_list: RolePermissionListSchema.optional(),
})

export type RolePayloadCreateInput = z.infer<typeof RolePayloadCrateSchema>
export type RolePayloadUpdateInput = z.infer<typeof RolePayloadUpdateSchema>

export interface RolePayloadCrateModel extends Omit<Prisma.RoleUncheckedCreateInput, 'permission'> {
  permission_list?: { [key: string]: boolean }
}
export interface RolePayloadUpdateModel extends Omit<
  Prisma.RoleUncheckedUpdateInput,
  'permission'
> {
  permission_list: { [key: string]: boolean }
}

export interface RoleFormModel extends Omit<RoleDataModel, GeneralOmitModel | 'permission'> {
  permission_list: { [key: string]: boolean }
}
