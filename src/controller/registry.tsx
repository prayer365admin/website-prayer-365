import {
  CountryCreate,
  CountryUpdate,
  isLanguageReady,
  LanguageCreate,
  LanguageSummary,
  LanguageUpdate,
} from '@/models/registry'
import {
  COUNT_COUNTRY_REFERENCES,
  COUNT_LANGUAGE_REFERENCES,
  CREATE_COUNTRY,
  CREATE_LANGUAGE,
  DELETE_COUNTRY,
  DELETE_LANGUAGE,
  GET_COUNTRIES,
  GET_COUNTRY_BY_CODE,
  GET_LANGUAGES,
  GET_LANGUAGE_BY_CODE,
  UPDATE_COUNTRY,
  UPDATE_LANGUAGE,
} from '@/providers/registry'
import { auditPayload } from '@/utils/audit'
import { dbTransaction } from '@/utils/db-transaction'
import { GeneralError } from '@/utils/general-error'

/*
 * Country / language registry business logic (SPEC §8.3 / Task 19).
 * Referenced rows are never destructively removed: a delete is refused when
 * any org node / church / user references the row.
 */

const notFound = (error_code: string) =>
  new GeneralError({ code: 404, error: 'NOT_FOUND', error_code, details: 'Resource not found.' })

const referenced = (resource: 'country' | 'language') =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'REFERENCED_ROWS',
    details: `This ${resource} is referenced and cannot be deleted.`,
  })

const stale = (resource: 'country' | 'language') =>
  new GeneralError({
    code: 409,
    error: 'CONFLICT',
    error_code: 'STALE_VERSION',
    details: `This ${resource} has changed. Refresh and try again.`,
  })

/** Enabling a language before its app resources ship is refused (SPEC §8.3, DESIGN S23). */
const assertLanguageReady = (code: string, enabled: boolean | undefined) => {
  if (enabled && !isLanguageReady(code)) {
    throw new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'LANGUAGE_NOT_READY',
      details: 'This language cannot be enabled until its translations are ready.',
    })
  }
}

const toLanguageSummary = (row: {
  code: string
  name: string
  enabled: boolean
  version: number
}): LanguageSummary => {
  const code = row.code.trim()
  return {
    code,
    name: row.name,
    enabled: row.enabled,
    version: row.version,
    ready: isLanguageReady(code),
  }
}

export const listCountries = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => GET_COUNTRIES({ page, limit, order_direction })

export const createCountry = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: CountryCreate
  actorId: string
  requestId: string
}) => {
  const existing = await GET_COUNTRY_BY_CODE({ code: payload.code })
  if (existing) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'COUNTRY_EXISTS',
      details: 'Country already exists.',
    })
  }
  return dbTransaction(async (tx) => {
    const row = await CREATE_COUNTRY(
      { code: payload.code, name: payload.name, enabled: payload.enabled },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'country.create',
        resourceType: 'country',
        resourceId: row.code,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const updateCountry = async ({
  code,
  payload,
  actorId,
  requestId,
}: {
  code: string
  payload: CountryUpdate
  actorId: string
  requestId: string
}) => {
  const existing = await GET_COUNTRY_BY_CODE({ code })
  if (!existing) throw notFound('COUNTRY_NOT_FOUND')
  return dbTransaction(async (tx) => {
    const row = await UPDATE_COUNTRY(
      {
        code,
        expectedVersion: payload.version,
        payload: { name: payload.name, enabled: payload.enabled },
      },
      tx,
    )
    if (!row) throw stale('country')
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'country.update',
        resourceType: 'country',
        resourceId: code,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const deleteCountry = async ({
  code,
  actorId,
  requestId,
}: {
  code: string
  actorId: string
  requestId: string
}) => {
  const existing = await GET_COUNTRY_BY_CODE({ code })
  if (!existing) throw notFound('COUNTRY_NOT_FOUND')
  const refs = await COUNT_COUNTRY_REFERENCES({ code })
  if (refs > 0) throw referenced('country')
  return dbTransaction(async (tx) => {
    const row = await DELETE_COUNTRY({ code }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'country.delete',
        resourceType: 'country',
        resourceId: code,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}

export const listLanguages = async ({
  page,
  limit,
  order_direction,
}: {
  page: number
  limit: number
  order_direction: 'asc' | 'desc'
}) => {
  const data = await GET_LANGUAGES({ page, limit, order_direction })
  return { total: data.total, result: data.result.map(toLanguageSummary) }
}

export const createLanguage = async ({
  payload,
  actorId,
  requestId,
}: {
  payload: LanguageCreate
  actorId: string
  requestId: string
}) => {
  assertLanguageReady(payload.code, payload.enabled)
  const existing = await GET_LANGUAGE_BY_CODE({ code: payload.code })
  if (existing) {
    throw new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'LANGUAGE_EXISTS',
      details: 'Language already exists.',
    })
  }
  return dbTransaction(async (tx) => {
    const row = await CREATE_LANGUAGE(
      { code: payload.code, name: payload.name, enabled: payload.enabled },
      tx,
    )
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'language.create',
        resourceType: 'language',
        resourceId: row.code,
        outcome: 'success',
        requestId,
      }),
    })
    return toLanguageSummary(row)
  })
}

export const updateLanguage = async ({
  code,
  payload,
  actorId,
  requestId,
}: {
  code: string
  payload: LanguageUpdate
  actorId: string
  requestId: string
}) => {
  const existing = await GET_LANGUAGE_BY_CODE({ code })
  if (!existing) throw notFound('LANGUAGE_NOT_FOUND')
  assertLanguageReady(code, payload.enabled)
  return dbTransaction(async (tx) => {
    const row = await UPDATE_LANGUAGE(
      {
        code,
        expectedVersion: payload.version,
        payload: { name: payload.name, enabled: payload.enabled },
      },
      tx,
    )
    if (!row) throw stale('language')
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'language.update',
        resourceType: 'language',
        resourceId: code,
        outcome: 'success',
        requestId,
      }),
    })
    return toLanguageSummary(row)
  })
}

export const deleteLanguage = async ({
  code,
  actorId,
  requestId,
}: {
  code: string
  actorId: string
  requestId: string
}) => {
  const existing = await GET_LANGUAGE_BY_CODE({ code })
  if (!existing) throw notFound('LANGUAGE_NOT_FOUND')
  const refs = await COUNT_LANGUAGE_REFERENCES({ code })
  if (refs.churchLangs > 0 || refs.users > 0) throw referenced('language')
  return dbTransaction(async (tx) => {
    const row = await DELETE_LANGUAGE({ code }, tx)
    await tx.auditLog.create({
      data: auditPayload({
        actorId,
        action: 'language.delete',
        resourceType: 'language',
        resourceId: code,
        outcome: 'success',
        requestId,
      }),
    })
    return row
  })
}
