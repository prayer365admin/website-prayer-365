import { PrismaClient } from '@prisma/client'
export const db = new PrismaClient()

const verifiedSeedUser = {
  email_verified_at: new Date(),
}

export const seedUsers = async () => {
  const administrator = await db.user.findUnique({ where: { email: 'admin@catatia.com' } })
  const staff = await db.user.findUnique({ where: { email: 'staff@catatia.com' } })

  if (!administrator) {
    await db.user.create({
      data: {
        email: 'admin@catatia.com',
        name: 'admin',
        password: '$2a$12$aiMbVTtXM5GrIG.EdOFICO.mfvPgtOBk/.7vpX20bZL5IBqS9jPdm',
        ...verifiedSeedUser,
        role: {
          connect: {
            name: 'administrator',
          },
        },
      },
    })
  } else {
    // Self-healing: pre-existing seed accounts are dashboard-equivalent → verified.
    await db.user.update({
      where: { id: administrator.id },
      data: verifiedSeedUser,
    })
  }

  if (!staff) {
    await db.user.create({
      data: {
        email: 'staff@catatia.com',
        name: 'staff',
        password: '$2a$12$wTaAWjdSy1RA123VhmU4NutWLC9MtAaUQKq87vottek3MtGSk.AZq',
        ...verifiedSeedUser,
        role: {
          connect: {
            name: 'staff',
          },
        },
      },
    })
  } else {
    await db.user.update({
      where: { id: staff.id },
      data: verifiedSeedUser,
    })
  }
}
