import { db } from '@/utils/db-connection'
import { Prisma, RoleType } from '@prisma/client'

const ROLE_INCLUDE = { permission: true } as const

export const GET_ROLES = async ({ type }: { type?: RoleType } = {}) => {
  const result = await db.role.findMany({
    where: { type: type },
    orderBy: { created_at: 'desc' },
    include: ROLE_INCLUDE,
  })
  return result
}

export const GET_ROLE_BY_ID = async ({ role_id }: { role_id: string }) => {
  const result = await db.role.findUnique({
    where: { id: role_id },
    include: ROLE_INCLUDE,
  })
  return result
}

export const GET_ROLE_BY_NAME = async ({
  name,
}: {
  name: string
}): Promise<{ id: string; name: string; type: RoleType } | null> =>
  db.role.findUnique({ where: { name }, select: { id: true, name: true, type: true } })

/** Rows that would break a hard delete: identity bindings and org assignments. */
export const COUNT_ROLE_USAGE = async ({
  role_id,
}: {
  role_id: string
}): Promise<{ users: number; assignments: number }> => {
  const [users, assignments] = await db.$transaction([
    db.user.count({ where: { role_id } }),
    db.roleAssignment.count({ where: { role_id } }),
  ])
  return { users, assignments }
}

export const CREATE_ROLE = async (
  payload: Prisma.RoleCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.role.create({ data: payload })

export const UPDATE_ROLE = async (
  {
    role_id,
    name,
    permission_list,
    type,
  }: {
    role_id: string
    name: string
    permission_list: { [key: string]: boolean }
    type: RoleType
  },
  tx: Prisma.TransactionClient = db,
) => {
  const connect_permission_list = Object.keys(permission_list).filter(
    (uuid) => permission_list[uuid],
  )

  return tx.role.update({
    data: {
      name: name,
      type: type,
      permission: {
        set: [],
        connect: connect_permission_list.map((item) => ({ id: item })),
      },
    },
    where: { id: role_id },
  })
}

export const DELETE_ROLE = async (
  { role_id }: { role_id: string },
  tx: Prisma.TransactionClient = db,
) => tx.role.delete({ where: { id: role_id } })
