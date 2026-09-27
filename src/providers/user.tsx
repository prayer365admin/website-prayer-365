import { GeneralQueryParams } from '@/models/general-query-params'
import { MeResult } from '@/models/me'
import { scopeKind } from '@/providers/scope'
import { RoleType } from '@prisma/client'
import { db } from '@/utils/db-connection'
import keywordSearch from '@/utils/keyword-search'
import { Prisma } from '@prisma/client'

const data = 'user'

// Never return the password hash from any read/write that surfaces a DTO.
const SAFE = { password: true }

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
      omit: SAFE,
      include: { role: { include: { permission: true } } },
    }),
  ])

  return { result, total }
}

export const GET_USER_BY_ID = async ({ user_id }: { user_id: string }) => {
  const result = await db.user.findUnique({
    where: { id: user_id },
    omit: SAFE,
    include: { role: { include: { permission: true } } },
  })
  return result
}

export const GET_USER_BY_EMAIL = async ({ email }: { email: string }) => {
  const result = await db.user.findUnique({
    where: { email: email },
    include: { role: { include: { permission: true } } },
  })
  return result
}

export const CREATE_USER = async (payload: {
  email: string
  name: string
  password: string
  email_verified_at?: Date | null
}) => {
  const result = await db.user.create({ data: payload, omit: SAFE })
  return result
}

export const UPDATE_USER = async ({
  user_id,
  payload,
}: {
  user_id: string
  payload: {
    name?: string
    password?: string
    email_verified_at?: Date | null
    profile_picture?: string | null
  }
}) => {
  const result = await db.user.update({
    data: {
      name: payload.name,
      password: payload.password,
      email_verified_at: payload.email_verified_at,
      profile_picture: payload.profile_picture,
    },
    where: { id: user_id },
    omit: SAFE,
  })
  return result
}

/**
 * Safe identity + accessible scopes (Task 9). Never returns password/tokens.
 */
export const GET_ME = async ({ user_id }: { user_id: string }): Promise<MeResult | null> => {
  const user = await db.user.findUnique({
    where: { id: user_id },
    select: { id: true, email: true, name: true },
  })
  if (!user) return null

  const assignments = await db.roleAssignment.findMany({
    where: { user_id, revoked_at: null },
    select: {
      org_node: { select: { id: true, kind: true, name: true } },
    },
    distinct: ['org_node_id'],
  })

  const scopes = assignments.map((a) => ({
    kind: scopeKind(a.org_node.kind),
    orgNodeId: a.org_node.id,
    name: a.org_node.name,
  }))

  return { ...user, scopes }
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
