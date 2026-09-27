import { db } from '../../src/utils/db-connection'
import { ADMINISTRATOR_ROLE } from './role'
import { PRAYER_ROLES } from './prayer-roles'

/*
 * Role <-> Permission connection layer (implicit `_role_permission` join).
 * Runs after permission.ts and role.ts; only wires existing rows.
 *
 * - administrator: EVERY permission (all-access platform role).
 * - each Prayer role: its grants from SPEC §3.4 (via the prayer-role matrix).
 *
 * Idempotent: each role's grant set is replaced (set) on every run.
 */

export const seedRolePermissions = async () => {
  // Administrator: all access.
  const allPermissions = await db.permission.findMany()
  await db.role.update({
    where: { name: ADMINISTRATOR_ROLE },
    data: { permission: { set: allPermissions.map((p) => ({ id: p.id })) } },
  })

  // Prayer roles: resolve their grant set from the catalogue.
  for (const role of PRAYER_ROLES) {
    const or = role.grants.map((g) => ({
      subject: g.subject,
      actions: { in: g.actions.split(',') },
      scope: g.scope,
    }))
    const perms = await db.permission.findMany({ where: { OR: or } })
    await db.role.update({
      where: { name: role.name },
      data: { permission: { set: perms.map((p) => ({ id: p.id })) } },
    })
  }
}
