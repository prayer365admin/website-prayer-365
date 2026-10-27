import { db } from '../../src/utils/db-connection'
import { PRAYER_ROLES } from './prayer-roles'
import { getDemoChurch, getDemoChurchNode } from './test-context'
import { ST_JOHNS_CHURCH_NAME } from './church'

// Every seeded user is verified and has a language (English by default, R-07).
const verifiedSeedUser = {
  email_verified_at: new Date(),
  locale_language: { connect: { code: 'en' } },
}

// Known demo password for the prayer test + admin accounts — plaintext: `Test123!`
// (bcryptjs hash of Test123!). Kept as a single constant so the manual test plan
// can document one working login for every seeded account. Change before real rollout.
export const TEST_PASSWORD = '$2b$12$6hmwy2T/qCvpmzmzi5VLO.KVXRoHDPmkRu.fO.soPraM/uY2msHo2'

// End-users are Users with NO role (SPEC: mobile auth D1; "No mobile staff
// grant is created by registration"). Their access is subject-only via
// user_churches / device tokens / notification preferences.
const END_USERS = [
  { email: 'believer@example.com', name: 'Demo Believer' },
  { email: 'visitor@example.com', name: 'Demo Visitor' },
]

// Administrator (all access) — seeded early; domain seeds reference it as actor.
export const seedAdminUser = async () => {
  const admin = await db.user.upsert({
    where: { email: 'admin@catatia.com' },
    update: { ...verifiedSeedUser, password: TEST_PASSWORD },
    create: {
      email: 'admin@catatia.com',
      name: 'admin',
      password: TEST_PASSWORD,
      ...verifiedSeedUser,
      role: { connect: { name: 'administrator' } },
    },
  })

  // The admin holds a GLOBAL role_assignment for the org-hierarchy scoping
  // layer (requiredScope) — central/church route tenancy. This is the church/
  // region data boundary, distinct from the identity role above.
  const globalNode = await db.orgNode.findFirst({ where: { kind: 'GLOBAL' } })
  if (globalNode) {
    const roleRow = await db.role.findUnique({ where: { name: 'administrator' } })
    if (roleRow) {
      const existing = await db.roleAssignment.findFirst({
        where: {
          user_id: admin.id,
          role_id: roleRow.id,
          org_node_id: globalNode.id,
          revoked_at: null,
        },
      })
      if (!existing) {
        await db.roleAssignment.create({
          data: {
            user_id: admin.id,
            role_id: roleRow.id,
            org_node_id: globalNode.id,
            granted_by: admin.id,
          },
        })
      }
    }
  }

  return admin
}

// Prayer test accounts + end-users. Runs after org hierarchy + admin exist.
export const seedUsers = async () => {
  const admin = await seedAdminUser()

  // Prayer test accounts (one per role). Each binds its single role via
  // role_id (identity/RBAC) AND holds a role_assignment (org-scoping for the
  // 74 church/region routes). Both layers must exist for option-1 hybrid.
  for (const role of PRAYER_ROLES) {
    const email = `${role.name}@example.com`
    const user = await db.user.upsert({
      where: { email },
      update: { password: TEST_PASSWORD },
      create: {
        email,
        name: role.name,
        password: TEST_PASSWORD,
        ...verifiedSeedUser,
        role: { connect: { name: role.name } },
      },
    })

    const kind =
      role.name === 'prayer_global_admin'
        ? 'GLOBAL'
        : role.name === 'prayer_country_admin'
          ? 'COUNTRY'
          : role.name === 'prayer_diocese_admin'
            ? 'DIOCESE'
            : role.name === 'prayer_deanery_admin'
              ? 'DEANERY'
              : 'CHURCH'
    // Church-level test accounts are pinned to the demo church, not whichever
    // CHURCH node happens to come first.
    const node =
      kind === 'CHURCH'
        ? await getDemoChurchNode()
        : await db.orgNode.findFirst({ where: { kind } })
    const roleRow = await db.role.findUnique({ where: { name: role.name } })
    if (!node || !roleRow) continue

    const existing = await db.roleAssignment.findFirst({
      where: { user_id: user.id, role_id: roleRow.id, org_node_id: node.id, revoked_at: null },
    })
    if (!existing) {
      await db.roleAssignment.create({
        data: { user_id: user.id, role_id: roleRow.id, org_node_id: node.id, granted_by: admin.id },
      })
    }
  }

  // End-users (no role) + subject-only mobile records.
  const church = await getDemoChurch()
  const stJohnsChurch = await db.church.findFirst({ where: { name: ST_JOHNS_CHURCH_NAME } })
  for (const eu of END_USERS) {
    // Demo customers have finished onboarding (parish + language, WB-15), so
    // they land on /customer; register a new account to try /customer/setup.
    const onboarded = {
      ...verifiedSeedUser,
      church_setup_completed_at: new Date(),
      locale_setup_completed_at: new Date(),
    }
    const user = await db.user.upsert({
      where: { email: eu.email },
      update: onboarded,
      create: {
        email: eu.email,
        name: eu.name,
        password: TEST_PASSWORD,
        ...onboarded, // no role: legacy role-less customer
      },
    })
    const targetChurch =
      eu.email === 'believer@example.com' && stJohnsChurch ? stJohnsChurch : church
    if (!targetChurch) continue

    if (eu.email === 'believer@example.com') {
      await db.userChurch.updateMany({
        where: { user_id: user.id, is_main: true },
        data: { is_main: false },
      })
    }

    await db.userChurch.upsert({
      where: { user_id_church_id: { user_id: user.id, church_id: targetChurch.id } },
      update: {
        is_main: eu.email === 'believer@example.com',
        is_followed: true,
      },
      create: {
        user_id: user.id,
        church_id: targetChurch.id,
        is_main: eu.email === 'believer@example.com',
        is_followed: true,
      },
    })
    await db.deviceToken.upsert({
      where: { token_hash: `demo-token-${eu.email}` },
      update: {},
      create: {
        user_id: user.id,
        installation_id: `demo-install-${eu.email}`,
        platform: 'ios',
        token_ciphertext: `enc:demo-${eu.email}`,
        token_hash: `demo-token-${eu.email}`,
      },
    })
    await db.notificationPreference.upsert({
      where: { user_id_type: { user_id: user.id, type: 'daily_prayer' } },
      update: {},
      create: { user_id: user.id, type: 'daily_prayer', enabled: true },
    })
    await db.notificationPreference.upsert({
      where: { user_id_type: { user_id: user.id, type: 'donation_reminder' } },
      update: {},
      create: { user_id: user.id, type: 'donation_reminder', enabled: false }, // opt-in default false
    })
  }
}
