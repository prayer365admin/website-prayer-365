import { ExamplePayloadCreateModel, ExamplePayloadUpdateModel } from '@/models/_example'
import { db } from '@/utils/db-connection'

// TODO: replace with your own data model, change _DATA to your data model name
const data = 'user'

export const GET_DATA = async () => {
  const result = await db[data].findMany({})
  return result
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
