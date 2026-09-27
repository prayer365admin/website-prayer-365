import { GeneralQueryParams } from '@/models/general-query-params'
import { UserPayloadCreateModel, UserPayloadUpdateModel } from '@/models/user'
import { db } from '@/utils/db-connection'
import keywordSearch from '@/utils/keyword-search'
import { Prisma, RoleType } from '@prisma/client'

const data = 'user'

export const GET_USERS = async ({
  limit,
  page,
  order_by,
  order_direction,
  search,
}: GeneralQueryParams) => {
  const offset = page && limit && (page - 1) * limit

  const filter: Prisma.UserWhereInput = {
    ...(search && {
      OR: [
        ...keywordSearch({ keyword: search, name: 'name' }),
        ...keywordSearch({ keyword: search, name: 'email' }),
      ],
    }),
  }

  const [total, result] = await db.$transaction([
    db[data].count({ where: filter }),
    db[data].findMany({
      take: limit,
      skip: offset,
      where: filter,
      orderBy: {
        ...(order_by && order_direction ? { [order_by]: order_direction } : { created_at: 'desc' }),
      },
      include: { role: { include: { permission: true } } },
    }),
  ])

  return { result, total }
}

export const GET_USER_BY_ID = async ({ user_id }: { user_id: string }) => {
  const result = await db.user.findUnique({ where: { id: user_id } })
  return result
}

export const GET_USER_BY_EMAIL = async ({ email }: { email: string }) => {
  const result = await db.user.findUnique({
    where: { email: email },
    include: { role: { include: { permission: true } } },
  })
  return result
}

export const CREATE_USER = async (payload: UserPayloadCreateModel) => {
  const result = await db.user.create({ data: payload })
  return result
}

export const UPDATE_USER = async ({
  user_id,
  payload,
}: {
  user_id: string
  payload: UserPayloadUpdateModel
}) => {
  const result = await db.user.update({
    data: {
      name: payload.name,
      password: payload.password,
      role_id: payload.role_id,
      email_verified_at: payload.email_verified_at,
      profile_picture: payload.profile_picture,
    },
    where: { id: user_id },
  })
  return result
}

export const GET_USER_BY_ROLE_TYPE = async ({ type, name }: { type: RoleType; name?: string }) => {
  const result = await db.role.findFirst({
    where: {
      type: type,
      ...(name && { name: name }),
    },
  })
  return result
}

export const DELETE_USER = async ({ user_id }: { user_id: string }) => {
  const result = await db.user.delete({ where: { id: user_id } })
  return result
}
