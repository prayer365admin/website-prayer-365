import { Prisma } from '@prisma/client'
import { db } from '@/utils/db-connection'

/*
 * Country / language registry provider (Task 19). Referenced rows are never
 * destructively removed: the controller counts references before allowing a
 * delete, and disables are permitted even when referenced (SPEC §5.1).
 */

export const GET_COUNTRIES = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => {
  const [total, result] = await db.$transaction([
    db.country.count(),
    db.country.findMany({
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { name: order_direction },
    }),
  ])
  return { total, result }
}

export const GET_COUNTRY_BY_CODE = async ({ code }: { code: string }) =>
  db.country.findUnique({ where: { code } })

export const CREATE_COUNTRY = async (
  payload: Prisma.CountryUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.country.create({ data: payload })

/** Version-guarded update; returns null when `expectedVersion` is stale. */
export const UPDATE_COUNTRY = async (
  {
    code,
    expectedVersion,
    payload,
  }: { code: string; expectedVersion: number; payload: Prisma.CountryUpdateManyMutationInput },
  tx: Prisma.TransactionClient = db,
) => {
  const updated = await tx.country.updateMany({
    where: { code, version: expectedVersion },
    data: { ...payload, version: { increment: 1 } },
  })
  if (updated.count === 0) return null
  return tx.country.findUnique({ where: { code } })
}

export const COUNT_COUNTRY_REFERENCES = async ({ code }: { code: string }) =>
  db.orgNode.count({ where: { country_code: code } })

export const DELETE_COUNTRY = async (
  { code }: { code: string },
  tx: Prisma.TransactionClient = db,
) => tx.country.delete({ where: { code } })

export const GET_LANGUAGES = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => {
  const [total, result] = await db.$transaction([
    db.language.count(),
    db.language.findMany({
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { code: order_direction },
    }),
  ])
  return { total, result }
}

export const GET_LANGUAGE_BY_CODE = async ({ code }: { code: string }) =>
  db.language.findUnique({ where: { code } })

export const CREATE_LANGUAGE = async (
  payload: Prisma.LanguageUncheckedCreateInput,
  tx: Prisma.TransactionClient = db,
) => tx.language.create({ data: payload })

/** Version-guarded update; returns null when `expectedVersion` is stale. */
export const UPDATE_LANGUAGE = async (
  {
    code,
    expectedVersion,
    payload,
  }: { code: string; expectedVersion: number; payload: Prisma.LanguageUpdateManyMutationInput },
  tx: Prisma.TransactionClient = db,
) => {
  const updated = await tx.language.updateMany({
    where: { code, version: expectedVersion },
    data: { ...payload, version: { increment: 1 } },
  })
  if (updated.count === 0) return null
  return tx.language.findUnique({ where: { code } })
}

export const COUNT_LANGUAGE_REFERENCES = async ({ code }: { code: string }) => {
  const [churchLangs, users] = await db.$transaction([
    db.churchLanguage.count({ where: { language_code: code } }),
    db.user.count({ where: { locale: code } }),
  ])
  return { churchLangs, users }
}

export const DELETE_LANGUAGE = async (
  { code }: { code: string },
  tx: Prisma.TransactionClient = db,
) => tx.language.delete({ where: { code } })
