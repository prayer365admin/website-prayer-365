import { ExamplePayloadCreateModel, ExamplePayloadUpdateModel } from '@/models/_example'
import { GeneralQueryParams } from '@/models/general-query-params'
import { db } from '@/utils/db-connection'
import keywordSearch from '@/utils/keyword-search'
import { Prisma } from '@prisma/client'

// TODO: replace with your own data model, change _DATA to your data model name
const data = 'user'

export const GET_DATA = async ({
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

export const GET_DATA_BY_ID = async ({ id }: { id: string }) => {
  const result = await db[data].findUnique({
    where: { id: id },
  })
  return result
}

export const CREATE_DATA = async (payload: ExamplePayloadCreateModel) => {
  const result = await db[data].create({ data: payload })
  return result
}

export const UPDATE_DATA = async ({
  id,
  payload,
}: {
  id: string
  payload: ExamplePayloadUpdateModel
}) => {
  const result = await db[data].update({
    data: payload,
    where: { id: id },
  })
  return result
}

export const DELETE_DATA = async ({ id }: { id: string }) => {
  const result = await db[data].delete({ where: { id: id } })
  return result
}
