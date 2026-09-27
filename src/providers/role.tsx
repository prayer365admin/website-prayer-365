import { RolePayloadCrateModel } from '@/models/role'
import { db } from '@/utils/db-connection'
import { RoleType } from '@prisma/client'

export const GET_ROLES = async ({ type }: { type?: RoleType } = {}) => {
  const result = await db.role.findMany({
    where: { type: type },
    orderBy: { created_at: 'desc' },
    include: { permission: true },
  })
  return result
}

export const GET_ROLE_BY_ID = async ({ role_id }: { role_id: string }) => {
  const result = await db.role.findUnique({
    where: { id: role_id },
    include: { permission: true },
  })
  return result
}

export const CREATE_ROLE = async (payload: RolePayloadCrateModel) => {
  const result = await db.role.create({ data: payload })
  return result
}

export const UPDATE_ROLE = async ({
  role_id,
  name,
  permission_list,
  type,
}: {
  role_id: string
  name: string
  permission_list: { [key: string]: boolean }
  type: RoleType
}) => {
  const connect_permission_list = Object.keys(permission_list).filter(
    (uuid) => permission_list[uuid],
  )

  const result = await db.role.update({
    data: {
      name: name,
      type: type,
      permission: {
        set: [],
        connect: connect_permission_list.map((item) => {
          return { id: item }
        }),
      },
    },
    where: { id: role_id },
  })
  return result
}

export const DELETE_ROLE = async ({ role_id }: { role_id: string }) => {
  const result = await db.role.delete({ where: { id: role_id } })
  return result
}
