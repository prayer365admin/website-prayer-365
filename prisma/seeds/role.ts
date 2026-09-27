import { db } from '../../src/utils/db-connection'
import { PRAYER_ROLES } from './prayer-roles'

/*
 * Roles ONLY. Permissions live in seeds/permission.ts; the role<->permission
 * connection is wired separately in seeds/role-permission.ts.
 *
 * Role set (SPEC §3.3): administrator (all access) + the Prayer role templates.
 * Template extras (staff, store-admin, member) are intentionally dropped per
 * user decision — SPEC's role catalogue is staff-only; end-users are Users
 * without any role (mobile auth D1 + no staff grant by registration).
 */

export const ADMINISTRATOR_ROLE = 'administrator'

export const seedRoles = async () => {
  await db.role.upsert({
    where: { name: ADMINISTRATOR_ROLE },
    update: { type: 'SYSTEM' },
    create: { name: ADMINISTRATOR_ROLE, type: 'SYSTEM' },
  })

  for (const role of PRAYER_ROLES) {
    await db.role.upsert({
      where: { name: role.name },
      update: { type: 'SYSTEM' },
      create: { name: role.name, type: 'SYSTEM' },
    })
  }
}
