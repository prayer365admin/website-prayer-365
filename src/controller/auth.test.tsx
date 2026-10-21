// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/controller/mail', () => ({ default: vi.fn() }))
vi.mock('@/controller/user', () => ({ updateUser: vi.fn() }))
vi.mock('@/utils/hash', () => ({ hashSecret: vi.fn().mockResolvedValue('hashed') }))
vi.mock('@/providers/auth-token', () => ({
  CREATE_AUTH_TOKEN: vi.fn().mockResolvedValue({ id: 'token-1', token: 'tok' }),
  COUNT_AUTH_TOKENS: vi.fn(),
  GET_LATEST_AUTH_TOKEN: vi.fn(),
  GET_VALID_AUTH_TOKEN: vi.fn(),
  USE_AUTH_TOKEN: vi.fn(),
}))
vi.mock('@/providers/user', () => ({
  CREATE_CUSTOMER: vi.fn(),
  GET_USER_BY_EMAIL: vi.fn(),
  UPDATE_USER: vi.fn(),
}))

import sendMail from '@/controller/mail'
import { registerUser } from '@/controller/auth'
import { USE_AUTH_TOKEN } from '@/providers/auth-token'
import { CREATE_CUSTOMER, GET_USER_BY_EMAIL } from '@/providers/user'

const input = {
  full_name: ' Maria ',
  email: 'Maria@Example.com ',
  password: 'password1',
  locale: 'sv',
  main_church_id: 'c1',
  baseUrl: 'http://localhost',
}

const created = {
  role: { id: 'r-user' },
  churchNotFound: false,
  user: { id: 'u1', email: 'maria@example.com', name: 'Maria' },
}

describe('registerUser (WB1 / WB-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(null)
    vi.mocked(CREATE_CUSTOMER).mockResolvedValue(created as never)
  })

  it('creates a prayer_user customer with locale + main church and sends the verification email', async () => {
    const result = await registerUser(input)

    expect(CREATE_CUSTOMER).toHaveBeenCalledWith({
      email: 'maria@example.com',
      name: 'Maria',
      password: 'hashed',
      locale: 'sv',
      main_church_id: 'c1',
      role_name: 'prayer_user',
    })
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      id: 'u1',
      email: 'maria@example.com',
      name: 'Maria',
      verification_email_sent: true,
    })
  })

  it('locale is optional: a missing locale remains unfinished for onboarding (R-06)', async () => {
    await registerUser({ ...input, locale: undefined })

    expect(CREATE_CUSTOMER).toHaveBeenCalledWith(expect.objectContaining({ locale: null }))
  })

  it.each([['unsupported', 'de']])(
    'rejects a %s locale with INVALID_LOCALE',
    async (_label, locale) => {
      await expect(registerUser({ ...input, locale: locale as never })).rejects.toMatchObject({
        code: 400,
        error_code: 'INVALID_LOCALE',
      })
      expect(CREATE_CUSTOMER).not.toHaveBeenCalled()
    },
  )

  it('main church is optional: signs up without one', async () => {
    await registerUser({ ...input, main_church_id: undefined })

    expect(CREATE_CUSTOMER).toHaveBeenCalledWith(
      expect.objectContaining({ main_church_id: undefined, locale: 'sv' }),
    )
    expect(sendMail).toHaveBeenCalledTimes(1)
  })

  it('rejects a non-approved main church with INVALID_MAIN_CHURCH and sends no email', async () => {
    vi.mocked(CREATE_CUSTOMER).mockResolvedValue({
      ...created,
      churchNotFound: true,
      user: null,
    } as never)

    await expect(registerUser(input)).rejects.toMatchObject({
      code: 400,
      error_code: 'INVALID_MAIN_CHURCH',
    })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('fails loudly when the prayer_user role is not seeded', async () => {
    vi.mocked(CREATE_CUSTOMER).mockResolvedValue({ role: null, user: null, churchNotFound: false })

    await expect(registerUser(input)).rejects.toMatchObject({
      code: 500,
      error_code: 'CUSTOMER_ROLE_MISSING',
    })
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email with USER_EXISTS', async () => {
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue({ id: 'u0' } as never)

    await expect(registerUser(input)).rejects.toMatchObject({ error_code: 'USER_EXISTS' })
    expect(CREATE_CUSTOMER).not.toHaveBeenCalled()
  })

  it('returns a recoverable result when the first verification email fails', async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new Error('mail unavailable'))

    await expect(registerUser(input)).resolves.toMatchObject({
      id: 'u1',
      email: 'maria@example.com',
      verification_email_sent: false,
    })
    expect(USE_AUTH_TOKEN).toHaveBeenCalledWith({ id: 'token-1' })
  })
})
