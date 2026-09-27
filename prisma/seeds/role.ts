import { Permission, PrismaClient } from '@prisma/client'
export const db = new PrismaClient()

export const seedRoles = async () => {
  await db.role.createMany({
    data: [
      { name: 'administrator', type: 'SYSTEM' },
      { name: 'staff', type: 'USER' },
      { name: 'store-admin', type: 'SYSTEM' },
      { name: 'member', type: 'USER' },
    ],
    skipDuplicates: true,
  })
  const allPermission = await db.permission.findMany()
  await db.role.update({
    where: { name: 'administrator' },
    data: {
      permission: {
        connect: allPermission.map((item: Permission) => {
          return { id: item.id }
        }),
      },
    },
  })
}
