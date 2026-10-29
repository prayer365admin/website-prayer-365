import { db } from '../utils/db-connection'
import { seedPermission } from '../../prisma/seeds/permission'
import { seedRolePermissions } from '../../prisma/seeds/role-permission'

/*
 * Targeted, idempotent access seed: the permission catalogue rows and the
 * role -> permission wiring only (both use createMany(skipDuplicates) / `set`).
 * Run it after a deploy that added catalogue rows, WITHOUT touching demo content:
 *   bun run seed:permissions
 * The full `prisma/seed.ts` also writes demo churches/prayers/users — use this
 * script when only the access tables must move.
 */
async function main() {
  await seedPermission()
  await seedRolePermissions()

  const [total, admin] = await Promise.all([
    db.permission.count(),
    db.role.findUnique({
      where: { name: 'administrator' },
      include: { _count: { select: { permission: true } } },
    }),
  ])
  // eslint-disable-next-line no-console -- operator needs the resulting counts
  console.log(`permissions: ${total} | administrator holds: ${admin?._count.permission ?? 0}`)
}

main()
  .then(async () => {
    await db.$disconnect()
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console -- seed failure must surface on stdout
    console.log(e)
    await db.$disconnect()
    process.exit(1)
  })
