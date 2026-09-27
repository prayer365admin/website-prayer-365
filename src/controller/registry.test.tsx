// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ auditLog: { create: vi.fn() } }),
  ),
}))

vi.mock('@/providers/registry', () => ({
  COUNT_COUNTRY_REFERENCES: vi.fn(),
  COUNT_LANGUAGE_REFERENCES: vi.fn(),
  CREATE_COUNTRY: vi.fn(),
  CREATE_LANGUAGE: vi.fn(),
  DELETE_COUNTRY: vi.fn(),
  DELETE_LANGUAGE: vi.fn(),
  GET_COUNTRIES: vi.fn(),
  GET_COUNTRY_BY_CODE: vi.fn(),
  GET_LANGUAGES: vi.fn(),
  GET_LANGUAGE_BY_CODE: vi.fn(),
  UPDATE_COUNTRY: vi.fn(),
  UPDATE_LANGUAGE: vi.fn(),
}))

import { createCountry, deleteCountry, deleteLanguage } from './registry'
import {
  COUNT_COUNTRY_REFERENCES,
  COUNT_LANGUAGE_REFERENCES,
  CREATE_COUNTRY,
  DELETE_COUNTRY,
  DELETE_LANGUAGE,
  GET_COUNTRY_BY_CODE,
  GET_LANGUAGE_BY_CODE,
} from '@/providers/registry'

describe('country registry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a country via provider', async () => {
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue(null as never)
    vi.mocked(CREATE_COUNTRY).mockResolvedValue({
      code: 'ES',
      name: 'Estonia',
      enabled: true,
    } as never)
    await expect(
      createCountry({
        payload: { code: 'ES', name: 'Estonia', enabled: true },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).resolves.toMatchObject({ code: 'ES' })
    expect(CREATE_COUNTRY).toHaveBeenCalled()
  })

  it('rejects a duplicate country (409)', async () => {
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue({ code: 'ES' } as never)
    await expect(
      createCountry({
        payload: { code: 'ES', name: 'Estonia', enabled: true },
        actorId: 'actor',
        requestId: 'r',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'COUNTRY_EXISTS' })
  })

  it('refuses to delete a referenced country (rows preserved)', async () => {
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue({ code: 'ES' } as never)
    vi.mocked(COUNT_COUNTRY_REFERENCES).mockResolvedValue(1)
    await expect(
      deleteCountry({ code: 'ES', actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'REFERENCED_ROWS' })
    expect(DELETE_COUNTRY).not.toHaveBeenCalled()
  })

  it('deletes an unreferenced country', async () => {
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue({ code: 'XX' } as never)
    vi.mocked(COUNT_COUNTRY_REFERENCES).mockResolvedValue(0)
    vi.mocked(DELETE_COUNTRY).mockResolvedValue({ code: 'XX' } as never)
    await expect(
      deleteCountry({ code: 'XX', actorId: 'actor', requestId: 'r' }),
    ).resolves.toMatchObject({ code: 'XX' })
    expect(DELETE_COUNTRY).toHaveBeenCalled()
  })

  it('returns 404 when deleting a missing country', async () => {
    vi.mocked(GET_COUNTRY_BY_CODE).mockResolvedValue(null as never)
    await expect(
      deleteCountry({ code: 'ZZ', actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 404, error_code: 'COUNTRY_NOT_FOUND' })
  })
})

describe('language registry', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses to delete a language referenced by church_languages or users', async () => {
    vi.mocked(GET_LANGUAGE_BY_CODE).mockResolvedValue({ code: 'en' } as never)
    vi.mocked(COUNT_LANGUAGE_REFERENCES).mockResolvedValue({ churchLangs: 2, users: 0 })
    await expect(
      deleteLanguage({ code: 'en', actorId: 'actor', requestId: 'r' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'REFERENCED_ROWS' })
    expect(DELETE_LANGUAGE).not.toHaveBeenCalled()
  })

  it('deletes an unreferenced language', async () => {
    vi.mocked(GET_LANGUAGE_BY_CODE).mockResolvedValue({ code: 'fi' } as never)
    vi.mocked(COUNT_LANGUAGE_REFERENCES).mockResolvedValue({ churchLangs: 0, users: 0 })
    vi.mocked(DELETE_LANGUAGE).mockResolvedValue({ code: 'fi' } as never)
    await expect(
      deleteLanguage({ code: 'fi', actorId: 'actor', requestId: 'r' }),
    ).resolves.toMatchObject({ code: 'fi' })
    expect(DELETE_LANGUAGE).toHaveBeenCalled()
  })
})
