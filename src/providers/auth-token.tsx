import { AuthTokenType } from '@prisma/client'
import { db } from '@/utils/db-connection'
import { generateRandomString } from '@/utils/generate-random-string'

export const CREATE_AUTH_TOKEN = async ({
  user_id,
  type,
  ttl_minutes,
}: {
  user_id: string
  type: AuthTokenType
  ttl_minutes: number
}) => {
  const token = generateRandomString(64)
  const result = await db.authToken.create({
    data: {
      user_id: user_id,
      token: token,
      type: type,
      expires_at: new Date(Date.now() + ttl_minutes * 60 * 1000),
    },
  })
  return result
}

export const GET_VALID_AUTH_TOKEN = async ({
  token,
  type,
}: {
  token: string
  type: AuthTokenType
}) => {
  const result = await db.authToken.findFirst({
    where: {
      token: token,
      type: type,
      used_at: null,
      expires_at: { gt: new Date() },
    },
  })
  return result
}

export const USE_AUTH_TOKEN = async ({ id }: { id: string }) => {
  const result = await db.authToken.update({
    data: { used_at: new Date() },
    where: { id: id },
  })
  return result
}

export const GET_LATEST_AUTH_TOKEN = async ({
  user_id,
  type,
}: {
  user_id: string
  type: AuthTokenType
}) => {
  const result = await db.authToken.findFirst({
    where: {
      user_id: user_id,
      type: type,
    },
    orderBy: { created_at: 'desc' },
  })
  return result
}
