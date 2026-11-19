// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/providers/mail-job', () => ({ ENQUEUE_MAIL_SEND: vi.fn() }))
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

import { ENQUEUE_MAIL_SEND } from '@/providers/mail-job'
import { registerUser, requestPasswordReset, resendVerificationEmail } from '@/controller/auth'
import { COUNT_AUTH_TOKENS, GET_LATEST_AUTH_TOKEN, USE_AUTH_TOKEN } from '@/providers/auth-token'
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

  it('mobile signup emails an app deep link, web signup keeps the web link', async () => {
    await registerUser({ ...input, linkPrefix: 'prayer-365://' })
    const link = (vi.mocked(ENQUEUE_MAIL_SEND).mock.calls[0][0].message.payload as { link: string })
      .link
    expect(link.startsWith('prayer-365://')).toBe(true)
    expect(link).toContain('verify-email?token=tok')
    expect(link).not.toContain('http')

    vi.mocked(ENQUEUE_MAIL_SEND).mockClear()
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(null)
    await registerUser(input)
    expect(vi.mocked(ENQUEUE_MAIL_SEND).mock.calls[0][0].message.payload).toMatchObject({
      link: 'http://localhost/verify-email?token=tok',
    })
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
    expect(ENQUEUE_MAIL_SEND).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKeySuffix: 'token-1',
        message: expect.objectContaining({
          template_name: 'verify-email',
          payload: expect.objectContaining({
            link: expect.stringContaining('token=tok'),
          }),
        }),
      }),
    )
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
    expect(ENQUEUE_MAIL_SEND).toHaveBeenCalledTimes(1)
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
    expect(ENQUEUE_MAIL_SEND).not.toHaveBeenCalled()
  })

  it('fails loudly when the prayer_user role is not seeded', async () => {
    vi.mocked(CREATE_CUSTOMER).mockResolvedValue({ role: null, user: null, churchNotFound: false })

    await expect(registerUser(input)).rejects.toMatchObject({
      code: 500,
      error_code: 'CUSTOMER_ROLE_MISSING',
    })
    expect(ENQUEUE_MAIL_SEND).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email with USER_EXISTS', async () => {
    vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue({ id: 'u0' } as never)

    await expect(registerUser(input)).rejects.toMatchObject({ error_code: 'USER_EXISTS' })
    expect(CREATE_CUSTOMER).not.toHaveBeenCalled()
  })

  it('returns a recoverable result when the first verification email fails', async () => {
    vi.mocked(ENQUEUE_MAIL_SEND).mockRejectedValueOnce(new Error('mail unavailable'))

    await expect(registerUser(input)).resolves.toMatchObject({
      id: 'u1',
      email: 'maria@example.com',
      verification_email_sent: false,
    })
    expect(USE_AUTH_TOKEN).toHaveBeenCalledWith({ id: 'token-1' })
  })
})

describe('account emails only reach live accounts (MB-06 soft delete)', () => {
  const account = (status: string) => ({
    id: 'u1',
    email: 'maria@example.com',
    name: 'Maria',
    status,
    email_verified_at: null,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(COUNT_AUTH_TOKENS).mockResolvedValue(0 as never)
    vi.mocked(GET_LATEST_AUTH_TOKEN).mockResolvedValue(null as never)
  })

  it.each(['inactive', 'disabled'])(
    'no password-reset email for a %s account (same soft success)',
    async (status) => {
      vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(account(status) as never)
      await expect(
        requestPasswordReset({ email: 'maria@example.com', baseUrl: 'http://x' }),
      ).resolves.toEqual({ success: true })
      expect(ENQUEUE_MAIL_SEND).not.toHaveBeenCalled()
    },
  )

  it.each(['inactive', 'disabled'])(
    'no verification email for a %s account (same soft success)',
    async (status) => {
      vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(account(status) as never)
      await expect(
        resendVerificationEmail({ email: 'maria@example.com', baseUrl: 'http://x' }),
      ).resolves.toHaveProperty('cooldown_seconds')
      expect(ENQUEUE_MAIL_SEND).not.toHaveBeenCalled()
    },
  )

  it.each(['active', 'deletion_pending'])(
    'a %s account still gets a password-reset email',
    async (status) => {
      vi.mocked(GET_USER_BY_EMAIL).mockResolvedValue(account(status) as never)
      await requestPasswordReset({ email: 'maria@example.com', baseUrl: 'http://x' })
      expect(ENQUEUE_MAIL_SEND).toHaveBeenCalledOnce()
    },
  )
})
