import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * WB-17 flow tests: the real controllers and providers (signup, verify,
 * credentials sign-in, setup progress, profile patch, password reset) run
 * end to end against a small in-memory stand-in for the Prisma client.
 * Only the database, mail transport and NextAuth runtime are faked.
 */

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const store = vi.hoisted(() => ({
  user: [] as Row[],
  role: [] as Row[],
  church: [] as Row[],
  userChurch: [] as Row[],
  authToken: [] as Row[],
  mails: [] as Row[],
}))

const fake = vi.hoisted(() => {
  let seq = 0
  const id = () => `id-${++seq}`
  // Prisma-like where: equality, null, { gt }, { gte }.
  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v === null) return row[k] == null
      if (v instanceof Date) return row[k]?.getTime() === v.getTime()
      if (typeof v === 'object') {
        if ('gt' in v) return row[k] > v.gt
        if ('gte' in v) return row[k] >= v.gte
      }
      return row[k] === v
    })
  const table = (rows: () => Row[], extra: Row = {}) => ({
    findUnique: async ({ where }: Row) => rows().find((r) => matches(r, where)) ?? null,
    findFirst: async ({ where, orderBy }: Row) => {
      const found = rows().filter((r) => matches(r, where))
      if (orderBy?.created_at === 'desc') found.reverse()
      return found[0] ?? null
    },
    count: async ({ where }: Row) => rows().filter((r) => matches(r, where)).length,
    create: async ({ data }: Row) => {
      const row = { id: id(), created_at: new Date(), ...data }
      rows().push(row)
      return row
    },
    update: async ({ where, data }: Row) => {
      const row = rows().find((r) => matches(r, where))
      if (!row) throw new Error('Record not found')
      for (const [k, v] of Object.entries(data)) {
        if (v === undefined) continue
        row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v
      }
      return row
    },
    updateMany: async ({ where, data }: Row) => {
      const found = rows().filter((r) => matches(r, where))
      found.forEach((r) => Object.assign(r, data))
      return { count: found.length }
    },
    ...extra,
  })
  return { id, matches, table }
})

vi.mock('@/utils/db-connection', () => {
  const user = fake.table(() => store.user, {
    create: async ({ data }: Row) => {
      const row = {
        id: fake.id(),
        created_at: new Date(),
        status: 'active',
        auth_version: 1,
        ...data,
      }
      store.user.push(row)
      return row
    },
    // GET_USER_BY_EMAIL includes the role (sign-in needs it).
    findUnique: async ({ where }: Row) => {
      const row = store.user.find((r) => fake.matches(r, where))
      if (!row) return null
      return { ...row, role: store.role.find((r) => r.id === row.role_id) ?? null }
    },
  })
  const userChurch = fake.table(() => store.userChurch, {
    // GET_ME_PROFILE selects the main church name through the relation.
    findFirst: async ({ where }: Row) => {
      const row = store.userChurch.find((r) => fake.matches(r, where))
      if (!row) return null
      return { ...row, church: store.church.find((c) => c.id === row.church_id) }
    },
    upsert: async ({ where, create, update }: Row) => {
      const key = where.user_id_church_id
      const row = store.userChurch.find(
        (r) => r.user_id === key.user_id && r.church_id === key.church_id,
      )
      if (row) return Object.assign(row, update)
      const created = { id: fake.id(), ...create }
      store.userChurch.push(created)
      return created
    },
  })
  const db: Row = {
    user,
    userChurch,
    role: fake.table(() => store.role),
    church: fake.table(() => store.church),
    authToken: fake.table(() => store.authToken),
  }
  // ponytail: no rollback; enough for the happy paths and guards tested here.
  db.$transaction = async (fn: (tx: Row) => unknown) => fn(db)
  return { db }
})

vi.mock('@/controller/mail', () => ({
  default: vi.fn(async (mail: Row) => {
    store.mails.push(mail)
  }),
}))

vi.mock('@/providers/auth-login-attempt', () => ({
  IS_LOGIN_BLOCKED: vi.fn().mockResolvedValue(false),
  RECORD_LOGIN_FAILURE: vi.fn().mockResolvedValue(undefined),
  CLEAR_LOGIN_FAILURES: vi.fn().mockResolvedValue(undefined),
}))

// NextAuth runtime pulls in next/server; only the credentials helpers are used.
vi.mock('next-auth', () => ({
  __esModule: true,
  default: () => ({ handlers: {}, signIn: {}, signOut: {}, auth: {} }),
  CredentialsSignin: class extends Error {
    code = ''
  },
}))
vi.mock('next-auth/providers/credentials', () => ({ __esModule: true, default: () => ({}) }))

import { customerAuthorize } from '@/auth'
import { registerUser, requestPasswordReset, resetPassword, verifyEmail } from './auth'
import { patchMe } from './mobile'
import { getSetupProgress } from './site'

const BASE = 'http://localhost:3000'
const EMAIL = 'maria@example.com'
const PASSWORD = 'Secret@123'

const lastLinkToken = () => {
  const link = store.mails[store.mails.length - 1].payload.link as string
  return new URL(link).searchParams.get('token') as string
}
const signIn = (password = PASSWORD) => customerAuthorize({ name: EMAIL, password })
const signInCode = (password?: string) =>
  signIn(password).then(
    () => null,
    (e: { code: string }) => e.code,
  )

const register = () =>
  registerUser({
    full_name: 'Maria',
    email: ` ${EMAIL.toUpperCase()} `,
    password: PASSWORD,
    baseUrl: BASE,
  })

const registerAndVerify = async () => {
  const { id } = await register()
  await verifyEmail({ token: lastLinkToken() })
  return id
}

describe('WB1 onboarding flows (WB-17)', () => {
  beforeEach(() => {
    for (const rows of Object.values(store)) rows.length = 0
    store.role.push({ id: 'role-user', name: 'prayer_user' })
    store.church.push(
      { id: 'c1', name: 'Tallinna Jaani', status: 'APPROVED' },
      { id: 'c2', name: 'Tartu Pauluse', status: 'APPROVED' },
    )
  })

  it('register → unverified sign-in blocked → verify → sign in as a customer', async () => {
    const { id } = await register()

    const user = store.user[0]
    expect(user).toMatchObject({ email: EMAIL, role_id: 'role-user', locale: null })
    expect(store.mails[0]).toMatchObject({ to: EMAIL, template_name: 'verify-email' })
    expect(await signInCode()).toBe('EMAIL_NOT_VERIFIED')

    await verifyEmail({ token: lastLinkToken() })

    expect(await signIn()).toMatchObject({
      user_id: id,
      email: EMAIL,
      role: { id: 'role-user', name: 'prayer_user' },
    })
  })

  it('a verification link works once', async () => {
    await register()
    const token = lastLinkToken()
    await verifyEmail({ token })

    await expect(verifyEmail({ token })).rejects.toMatchObject({ error_code: 'INVALID_OR_EXPIRED' })
  })

  it('the same email cannot register twice, and a wrong password is refused', async () => {
    await registerAndVerify()

    await expect(register()).rejects.toMatchObject({ code: 409, error_code: 'USER_EXISTS' })
    expect(await signInCode('Wrong@1234')).toBe('INVALID_CREDENTIALS')
  })

  it('setup: skipping both steps leaves it unfinished; filling both finishes it', async () => {
    const userId = await registerAndVerify()
    const progress = () => getSetupProgress({ userId })

    expect(await progress()).toEqual({
      churchStepDone: false,
      localeStepDone: false,
      completed: false,
    })

    // Skip parish, skip language (default locale saved, step not filled).
    await patchMe({ userId, data: { mainChurchId: null } })
    await patchMe({ userId, data: { locale: 'en', localeSkipped: true } })
    expect(store.user[0].locale).toBe('en')
    expect(await progress()).toEqual({
      churchStepDone: false,
      localeStepDone: false,
      completed: false,
    })

    // Fill parish: language step still open (resumes at step 2 on any browser).
    await patchMe({ userId, data: { mainChurchId: 'c1' } })
    expect(await progress()).toMatchObject({ churchStepDone: true, completed: false })

    // Fill language: setup complete.
    await patchMe({ userId, data: { locale: 'fi' } })
    expect(await progress()).toEqual({
      churchStepDone: true,
      localeStepDone: true,
      completed: true,
    })
  })

  it('setup steps record the first fill only', async () => {
    const userId = await registerAndVerify()
    await patchMe({ userId, data: { locale: 'et' } })
    const first = store.user[0].locale_setup_completed_at

    await patchMe({ userId, data: { locale: 'sv' } })

    expect(store.user[0].locale_setup_completed_at).toBe(first)
  })

  it('exactly one main church: changing it moves is_main, clearing it unsets it', async () => {
    const userId = await registerAndVerify()
    const mains = () => store.userChurch.filter((r) => r.user_id === userId && r.is_main)

    await patchMe({ userId, data: { mainChurchId: 'c1' } })
    await patchMe({ userId, data: { mainChurchId: 'c2' } })

    expect(mains().map((r) => r.church_id)).toEqual(['c2'])
    // The previous main church stays followed.
    expect(store.userChurch.find((r) => r.church_id === 'c1')).toMatchObject({
      is_main: false,
      is_followed: true,
    })

    const cleared = await patchMe({ userId, data: { mainChurchId: null } })
    expect(cleared.mainChurchId).toBeNull()
    expect(mains()).toEqual([])
  })

  it('an unapproved church cannot become the main church', async () => {
    const userId = await registerAndVerify()
    store.church.push({ id: 'c3', name: 'Pending', status: 'PENDING' })

    await expect(patchMe({ userId, data: { mainChurchId: 'c3' } })).rejects.toBeTruthy()
    expect(store.user[0].church_setup_completed_at).toBeUndefined()
  })

  it('forgot → reset: new password works, old one and the used link do not', async () => {
    await registerAndVerify()
    store.user[0].auth_version = 1 // DB default

    await requestPasswordReset({ email: EMAIL, baseUrl: BASE })
    expect(store.mails[store.mails.length - 1]).toMatchObject({ template_name: 'forgot-password' })
    const token = lastLinkToken()

    await resetPassword({ token, new_password: 'NewSecret@456' })

    expect(await signInCode()).toBe('INVALID_CREDENTIALS')
    expect(await signIn('NewSecret@456')).toMatchObject({ email: EMAIL })
    // Password change ends other sessions (requiredWebAuth checks auth_version).
    expect(store.user[0].auth_version).toBe(2)
    await expect(resetPassword({ token, new_password: 'Another@789' })).rejects.toMatchObject({
      error_code: 'INVALID_OR_EXPIRED_TOKEN',
    })
  })

  it('forgot password for an unknown email is a soft success with no mail', async () => {
    expect(await requestPasswordReset({ email: 'nobody@example.com', baseUrl: BASE })).toEqual({
      success: true,
    })
    expect(store.mails).toEqual([])
  })
})
