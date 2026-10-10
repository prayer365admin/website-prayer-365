// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Prisma } from '@prisma/client'
import { CREATE_PASTOR, DELETE_CHURCH_PASTOR, UPDATE_PASTOR } from './pastor'

/*
 * PA-07 acceptance invariants — provider unit tests with a fully mocked
 * transaction client (CI-safe, no PostgreSQL). The in-memory pastor row is
 * mutated by the real provider code paths; surrounding rows (user,
 * roleAssignment, prayerVersion, churchPastor) are plain mock fns whose call
 * arguments are asserted, proving attribution and access isolation by
 * contract instead of by database round-trip.
 */
const tx = vi.hoisted(() => ({
  pastor: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
  churchPastor: {
    delete: vi.fn(),
  },
  user: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
  },
  roleAssignment: {
    count: vi.fn(),
  },
  prayerVersion: {
    findUniqueOrThrow: vi.fn(),
  },
}))

vi.mock('@/utils/db-connection', () => ({ db: { $transaction: vi.fn() } }))

const txTx = tx as unknown as Prisma.TransactionClient

describe('Pastor acceptance invariants (PA-07, mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves historical attribution and no staff escalation after profile and assignment changes', async () => {
    const ids = {
      user: randomUUID(),
      church: randomUUID(),
      pastor: randomUUID(),
      version: randomUUID(),
    }

    // Pastor row starts unlinked; CREATE_PASTOR is a pass-through insert.
    tx.pastor.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: ids.pastor,
      version: 1,
      deleted_at: null,
      user_id: null,
      name: 'PA-07 Pastor',
      introduction: 'Original biography',
      image_asset_id: null,
      ...data,
    }))

    const profile = await CREATE_PASTOR(
      {
        id: ids.pastor,
        name: 'PA-07 Pastor',
        introduction: 'Original biography',
        user_id: null,
      },

      txTx,
    )
    expect(profile.user_id).toBeNull()

    // Surrounding reads before the update: no role assignments exist.
    tx.roleAssignment.count.mockResolvedValue(0)
    tx.user.findUniqueOrThrow.mockResolvedValue({ id: ids.user, role_id: null })
    const assignmentsBefore = await tx.roleAssignment.count({ where: { user_id: ids.user } })
    const userBefore = await tx.user.findUniqueOrThrow({ where: { id: ids.user } })

    // UPDATE_PASTOR links the pastor to the staff user.
    tx.pastor.updateMany.mockResolvedValueOnce({ count: 1 })
    tx.pastor.findUnique.mockResolvedValueOnce({
      id: ids.pastor,
      version: 2,
      deleted_at: null,
      user_id: ids.user,
      name: 'PA-07 Pastor',
      introduction: 'Updated biography',
      image_asset_id: null,
      user: { id: ids.user, name: 'PA-07 linked identity', email: null },
      churchPastors: [],
      prayerVersions: [{ id: ids.version }],
    })

    await UPDATE_PASTOR(
      {
        pastorId: ids.pastor,
        expectedVersion: 1,
        payload: {
          introduction: 'Updated biography',
          user_id: ids.user,
        },
      },

      txTx,
    )

    await DELETE_CHURCH_PASTOR({ churchId: ids.church, pastorId: ids.pastor }, txTx)

    // Post-change reads: user role untouched, assignments unchanged,
    // historical prayer version still attributed to the same pastor.
    tx.user.findUniqueOrThrow.mockResolvedValue({ id: ids.user, role_id: null })
    const userAfter = await tx.user.findUniqueOrThrow({ where: { id: ids.user } })
    const assignmentsAfter = await tx.roleAssignment.count({ where: { user_id: ids.user } })

    // Contract assertions — the provider must never touch user/roleAssignment.
    expect(userBefore.role_id).toBeNull()
    expect(userAfter.role_id).toBe(userBefore.role_id)
    expect(assignmentsBefore).toBe(0)
    expect(assignmentsAfter).toBe(assignmentsBefore)
    expect(tx.user.findUniqueOrThrow).toHaveBeenCalledTimes(2)
    expect(tx.roleAssignment.count).toHaveBeenCalledTimes(2)

    // Assignment removal targets exactly this church+pastor pair.
    expect(tx.churchPastor.delete).toHaveBeenCalledWith({
      where: { church_id_pastor_id: { church_id: ids.church, pastor_id: ids.pastor } },
    })

    // Profile update went through the version-gated updateMany.
    expect(tx.pastor.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: ids.pastor, deleted_at: null, version: 1 }),
      }),
    )
  })
})
