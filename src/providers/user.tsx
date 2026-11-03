import { GeneralQueryParams } from '@/models/general-query-params'
import { MeResult } from '@/models/me'
import { scopeKind } from '@/providers/scope'
import { RoleType } from '@prisma/client'
import { db } from '@/utils/db-connection'
import keywordSearch from '@/utils/keyword-search'
import { Prisma } from '@prisma/client'
import { CUSTOMER_ACCOUNT_FILTER, CUSTOMER_ROLE, isCustomerRole } from '@/utils/customer-role'
import { ADMINISTRATOR_ROLE } from '@/utils/constant'
import { S3_PUBLIC_URL } from '@/providers/s3'

const data = 'user'

// Never return the password hash from any read/write that surfaces a DTO.
const SAFE = { password: true }

/** Public fellowship total: active customer accounts only, never staff or deleted users. */
export const COUNT_ACTIVE_CUSTOMERS = (): Promise<number> =>
  db.user.count({
    where: {
      deleted_at: null,
      status: 'active',
      ...CUSTOMER_ACCOUNT_FILTER,
    },
  })

/**
 * Staff list: users with a staff role (not the `prayer_user` customer role, R-02).
 * Optional `role` filter narrows by role id.
 */
export const GET_USERS = async ({
  limit,
  page,
  order_by,
  order_direction,
  search,
  role,
  status,
  pastorLinked,
}: GeneralQueryParams & { role?: string; status?: string; pastorLinked?: boolean }) => {
  const offset = page && limit && (page - 1) * limit

  const filter: Prisma.UserWhereInput = {
    role: { is: { name: { not: CUSTOMER_ROLE } } },
    ...(role ? { role_id: role } : {}),
    ...(pastorLinked ? { pastors: { some: { deleted_at: null } } } : {}),
    ...(status === 'active'
      ? { status: 'active', deleted_at: null }
      : status === 'inactive'
        ? { NOT: { status: 'active', deleted_at: null } }
        : {}),
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
      omit: SAFE,
      include: {
        role: { include: { permission: true } },
        profile_asset: { select: { object_key: true, purpose: true, status: true } },
        roleAssignments: {
          where: { revoked_at: null },
          include: { org_node: { select: { kind: true, name: true } } },
          take: 1,
          orderBy: { created_at: 'asc' },
        },
      },
    }),
  ])

  const mapped = result.map((row) => ({
    ...row,
    role_assignments: row.roleAssignments,
    avatarUrl:
      row.profile_asset?.purpose === 'USER_AVATAR' && row.profile_asset.status === 'READY'
        ? S3_PUBLIC_URL({ key: row.profile_asset.object_key })
        : null,
    profile_asset: undefined,
  }))

  return { result: mapped, total }
}

/** Customer list: no role (legacy) or the `prayer_user` customer role (R-01/R-02). */
export const GET_CUSTOMERS = async ({
  limit,
  page,
  order_by,
  order_direction,
  search,
  status,
}: GeneralQueryParams & { status?: string }) => {
  const offset = page && limit && (page - 1) * limit

  const filter: Prisma.UserWhereInput = {
    AND: [
      { OR: [{ role_id: null }, { role: { is: { name: CUSTOMER_ROLE } } }] },
      ...(status === 'verified'
        ? [{ email_verified_at: { not: null } }]
        : status === 'unverified'
          ? [{ email_verified_at: null }]
          : status === 'active'
            ? [{ status: 'active', deleted_at: null }]
            : status === 'inactive'
              ? [{ NOT: { status: 'active', deleted_at: null } }]
              : []),
      ...(search
        ? [
            {
              OR: [
                ...keywordSearch({ keyword: search, name: 'name' }),
                ...keywordSearch({ keyword: search, name: 'email' }),
              ],
            },
          ]
        : []),
    ],
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
      include: {
        profile_asset: true,
      },
      omit: SAFE,
    }),
  ])

  const mapped = result.map((row) => ({
    ...row,
    avatarUrl:
      row.profile_asset?.purpose === 'USER_AVATAR' && row.profile_asset.status === 'READY'
        ? S3_PUBLIC_URL({ key: row.profile_asset.object_key })
        : null,
    profile_asset: undefined,
  }))

  return { result: mapped, total }
}

export const GET_USER_BY_ID = async ({ user_id }: { user_id: string }) => {
  const result = await db.user.findUnique({
    where: { id: user_id },
    omit: SAFE,
    include: { role: { include: { permission: true } } },
  })
  return result
}

export const GET_USER_BY_EMAIL = async ({ email }: { email: string }) => {
  const result = await db.user.findUnique({
    where: { email: email },
    include: { role: { include: { permission: true } } },
  })
  return result
}

export const GET_USER_BY_OAUTH_ACCOUNT = async ({
  provider,
  providerAccountId,
}: {
  provider: string
  providerAccountId: string
}) => {
  const account = await db.oAuthAccount.findUnique({
    where: {
      provider_provider_account_id: {
        provider,
        provider_account_id: providerAccountId,
      },
    },
    select: {
      user: {
        omit: SAFE,
        include: { role: { include: { permission: true } } },
      },
    },
  })
  return account?.user ?? null
}

/**
 * Link a verified OAuth identity to an existing customer, or create a new
 * customer with no password. Staff identities are never linked through the
 * customer sign-in page.
 */
export const FIND_OR_CREATE_OAUTH_CUSTOMER = async ({
  provider,
  providerAccountId,
  email,
  name,
  profilePicture,
}: {
  provider: string
  providerAccountId: string
  email: string
  name: string
  profilePicture: string | null
}) =>
  db.$transaction(async (tx) => {
    const linked = await tx.oAuthAccount.findUnique({
      where: {
        provider_provider_account_id: {
          provider,
          provider_account_id: providerAccountId,
        },
      },
      select: {
        user: {
          omit: SAFE,
          include: { role: { include: { permission: true } } },
        },
      },
    })

    if (linked) {
      return linked.user.status === 'active' && isCustomerRole(linked.user.role)
        ? linked.user
        : null
    }

    let user = await tx.user.findUnique({
      where: { email },
      omit: SAFE,
      include: { role: { include: { permission: true } } },
    })

    if (user && (user.status !== 'active' || !isCustomerRole(user.role))) return null

    if (user) {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          email_verified_at: user.email_verified_at ?? new Date(),
          profile_picture: user.profile_picture ?? profilePicture ?? undefined,
        },
        omit: SAFE,
        include: { role: { include: { permission: true } } },
      })
    } else {
      const role = await tx.role.findUnique({
        where: { name: CUSTOMER_ROLE },
        select: { id: true },
      })
      if (!role) return null

      user = await tx.user.create({
        data: {
          email,
          name,
          password: null,
          email_verified_at: new Date(),
          profile_picture: profilePicture,
          locale: null,
          role_id: role.id,
        },
        omit: SAFE,
        include: { role: { include: { permission: true } } },
      })
    }

    await tx.oAuthAccount.create({
      data: {
        user_id: user.id,
        provider,
        provider_account_id: providerAccountId,
      },
    })

    return user
  })

export const CREATE_USER = async (payload: {
  email: string
  name: string
  password: string
  email_verified_at?: Date | null
  role_id?: string | null
  profile_picture?: string | null
  profile_asset_id?: string | null
}) => {
  const { role_id, ...rest } = payload
  const result = await db.user.create({
    data: { ...rest, ...(role_id ? { role_id } : {}) },
    omit: SAFE,
  })
  return result
}

/**
 * Website/mobile customer signup (WB1): user with the `prayer_user` role and
 * locale, plus the main church row when one is chosen (optional), in one
 * transaction. `role` is null when the seed is missing; `churchNotFound` when a
 * main church was given but is not APPROVED (nothing is created then).
 */
export const CREATE_CUSTOMER = async (payload: {
  email: string
  name: string
  password: string
  locale: string | null
  main_church_id?: string | null
  role_name: string
}) =>
  db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { name: payload.role_name },
      select: { id: true },
    })
    if (!role) return { role: null, user: null, churchNotFound: false }

    const church = payload.main_church_id
      ? await tx.church.findFirst({
          where: { id: payload.main_church_id, status: 'APPROVED' },
          select: { id: true },
        })
      : null
    if (payload.main_church_id && !church) return { role, user: null, churchNotFound: true }

    const user = await tx.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        password: payload.password,
        locale: payload.locale,
        role_id: role.id,
      },
      omit: SAFE,
    })
    if (church) {
      await tx.userChurch.create({
        data: { user_id: user.id, church_id: church.id, is_main: true, is_followed: true },
      })
    }
    return { role, user, churchNotFound: false }
  })

export const UPDATE_USER = async ({
  user_id,
  payload,
}: {
  user_id: string
  payload: {
    name?: string
    email?: string
    password?: string
    email_verified_at?: Date | null
    profile_picture?: string | null
    profile_asset_id?: string | null
    role_id?: string | null
  }
}) => {
  const { role_id, ...rest } = payload
  const result = await db.user.update({
    data: { ...rest, ...(role_id ? { role_id } : {}) },
    where: { id: user_id },
    omit: SAFE,
  })
  return result
}

/** Stamp how and when a user last signed in (call only on a successful sign-in). */
export const RECORD_LOGIN = async ({ user_id, provider }: { user_id: string; provider: string }) =>
  db.user.update({
    where: { id: user_id },
    data: { last_login_provider: provider, last_active_at: new Date() },
    omit: SAFE,
  })

const TOUCH_INTERVAL_MS = 5 * 60 * 1000
const lastTouched = new Map<string, number>()

/**
 * Throttled activity stamp: at most one write per user per interval per process.
 * Fire-and-forget — an activity stamp must never fail an authorized request.
 */
export const TOUCH_LAST_ACTIVE = async ({ user_id }: { user_id: string }) => {
  const now = Date.now()
  if (now - (lastTouched.get(user_id) ?? 0) < TOUCH_INTERVAL_MS) return
  lastTouched.set(user_id, now)
  await db.user
    .update({ where: { id: user_id }, data: { last_active_at: new Date() } })
    .catch(() => {})
}

/**
 * Safe identity + accessible scopes (Task 9). Never returns password/tokens.
 */
export const GET_ME = async ({ user_id }: { user_id: string }): Promise<MeResult | null> => {
  const user = await db.user.findUnique({
    where: { id: user_id },
    select: { id: true, email: true, name: true },
  })
  if (!user) return null

  const assignments = await db.roleAssignment.findMany({
    where: { user_id, revoked_at: null },
    select: {
      org_node: { select: { id: true, kind: true, name: true } },
    },
    distinct: ['org_node_id'],
  })

  const scopes = assignments.map((a) => ({
    kind: scopeKind(a.org_node.kind),
    orgNodeId: a.org_node.id,
    name: a.org_node.name,
  }))

  return { ...user, scopes }
}

export const GET_USER_BY_ROLE_TYPE = async ({ type, name }: { type: RoleType; name?: string }) => {
  const result = await db.role.findFirst({
    where: {
      type: type,
      ...(name && { name: name }),
    },
  })
  return result
}

export const DELETE_USER = async ({ user_id }: { user_id: string }) => {
  const result = await db.user.delete({ where: { id: user_id } })
  return result
}

/** D1: bump `auth_version` on password change / account disable → invalidates all outstanding tokens. */
export const INCREMENT_AUTH_VERSION = async (
  { user_id }: { user_id: string },
  tx: Prisma.TransactionClient = db,
) => {
  const result = await tx.user.update({
    data: { auth_version: { increment: 1 } },
    where: { id: user_id },
    select: { id: true, auth_version: true },
  })
  return result
}

/**
 * Soft delete (plan 023): status inactive + deleted_at keeps the row (history,
 * foreign keys) while both guards and login refuse a non-active account.
 */
export const DEACTIVATE_USER = async (
  { user_id }: { user_id: string },
  tx: Prisma.TransactionClient = db,
) =>
  tx.user.update({
    where: { id: user_id },
    data: { status: 'inactive', deleted_at: new Date() },
    omit: SAFE,
  })

/** Other ACTIVE accounts bound to the super-admin role (last-admin guard). */
export const COUNT_ACTIVE_ADMINS = async ({
  excludeUserId,
}: {
  excludeUserId: string
}): Promise<number> =>
  db.user.count({
    where: {
      id: { not: excludeUserId },
      deleted_at: null,
      status: 'active',
      role: { is: { name: ADMINISTRATOR_ROLE } },
    },
  })
