// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { db } from '@/utils/db-connection'
import { CREATE_PASTOR, DELETE_CHURCH_PASTOR, UPDATE_PASTOR } from './pastor'

describe('Pastor acceptance invariants', () => {
  afterAll(async () => {
    await db.$disconnect()
  })

  it('preserves access isolation and historical attribution after profile and assignment changes', async () => {
    const suffix = randomUUID()
    const ids = {
      user: randomUUID(),
      node: randomUUID(),
      church: randomUUID(),
      pastor: randomUUID(),
      prayer: randomUUID(),
      version: randomUUID(),
    }
    const rollback = new Error('PA07_ROLLBACK')
    let thrown: unknown

    try {
      await db.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            id: ids.user,
            email: `pa07-${suffix}@example.test`,
            name: 'PA-07 linked identity',
          },
        })
        await tx.orgNode.create({
          data: { id: ids.node, kind: 'CHURCH', name: `PA-07 Church ${suffix}` },
        })
        await tx.church.create({
          data: {
            id: ids.church,
            org_node_id: ids.node,
            name: 'PA-07 Church',
            status: 'APPROVED',
            timezone: 'UTC',
            address: {},
            contacts: {},
            social_links: [],
          },
        })

        const profile = await CREATE_PASTOR(
          {
            id: ids.pastor,
            name: 'PA-07 Pastor',
            introduction: 'Original biography',
            user_id: null,
          },
          tx,
        )
        expect(profile.user_id).toBeNull()

        await tx.churchPastor.create({
          data: {
            church_id: ids.church,
            pastor_id: ids.pastor,
            pastoral_role: 'Pastor',
          },
        })
        await tx.prayer.create({
          data: {
            id: ids.prayer,
            church_id: ids.church,
            created_by: ids.user,
          },
        })
        await tx.prayerVersion.create({
          data: {
            id: ids.version,
            prayer_id: ids.prayer,
            version_number: 1,
            pastor_id: ids.pastor,
            title: 'Historical prayer',
            body: 'Immutable historical body',
            language_code: 'en',
            text_hash: 'pa07-historical-hash',
          },
        })

        const assignmentsBefore = await tx.roleAssignment.count({ where: { user_id: ids.user } })
        const userBefore = await tx.user.findUniqueOrThrow({ where: { id: ids.user } })

        await UPDATE_PASTOR(
          {
            pastorId: ids.pastor,
            expectedVersion: 1,
            payload: {
              introduction: 'Updated biography',
              user_id: ids.user,
            },
          },
          tx,
        )
        await DELETE_CHURCH_PASTOR({ churchId: ids.church, pastorId: ids.pastor }, tx)

        const userAfter = await tx.user.findUniqueOrThrow({ where: { id: ids.user } })
        const assignmentsAfter = await tx.roleAssignment.count({ where: { user_id: ids.user } })
        const storedVersion = await tx.prayerVersion.findUniqueOrThrow({
          where: { id: ids.version },
          select: { pastor_id: true },
        })
        const storedPastor = await tx.pastor.findUniqueOrThrow({
          where: { id: ids.pastor },
          select: {
            user_id: true,
            introduction: true,
            churchPastors: { select: { church_id: true } },
            prayerVersions: { select: { id: true } },
          },
        })

        expect(userBefore.role_id).toBeNull()
        expect(userAfter.role_id).toBe(userBefore.role_id)
        expect(assignmentsBefore).toBe(0)
        expect(assignmentsAfter).toBe(assignmentsBefore)
        expect(storedPastor).toMatchObject({
          user_id: ids.user,
          introduction: 'Updated biography',
          churchPastors: [],
          prayerVersions: [{ id: ids.version }],
        })
        expect(storedVersion.pastor_id).toBe(ids.pastor)

        throw rollback
      })
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(rollback)
    expect(await db.user.findUnique({ where: { id: ids.user } })).toBeNull()
  })
})
