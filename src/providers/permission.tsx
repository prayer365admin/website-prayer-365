import { db } from '@/utils/db-connection'

export const GET_PERMISSIONS = async () => {
  const result = await db.permission.findMany()
  return result
}
