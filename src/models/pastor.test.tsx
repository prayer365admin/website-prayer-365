import { describe, expect, it } from 'vitest'
import { ChurchPastorAssignSchema, PastorCreateSchema, PastorUpdateSchema } from './pastor'
import { expandPrayerCatalogue, PRAYER_ROLES } from '../../prisma/seeds/prayer-roles'

const pastorId = '00000000-0000-0000-0000-000000000001'

describe('Pastor API models', () => {
  it('requires a version and a changed profile field for central updates', () => {
    expect(PastorUpdateSchema.safeParse({ name: 'Updated' }).success).toBe(false)
    expect(PastorUpdateSchema.safeParse({ version: 2 }).success).toBe(false)
    expect(PastorUpdateSchema.safeParse({ version: 2, name: 'Updated' }).success).toBe(true)
  })

  it('rejects access-control fields on central pastor profile writes', () => {
    expect(PastorCreateSchema.safeParse({ name: 'Pastor', roleId: 'admin' }).success).toBe(false)
    expect(
      PastorUpdateSchema.safeParse({
        version: 2,
        introduction: 'Biography',
        roleAssignments: [{ roleKey: 'prayer_church_admin', orgNodeId: 'church-1' }],
      }).success,
    ).toBe(false)
  })

  it('accepts a canonical image asset ID on central updates', () => {
    expect(
      PastorUpdateSchema.safeParse({
        version: 2,
        imageAssetId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
  })

  it('rejects duplicate pastor IDs in a replacement assignment', () => {
    const parsed = ChurchPastorAssignSchema.safeParse({
      assigned: [{ pastorId }, { pastorId }],
    })
    expect(parsed.success).toBe(false)
  })

  it('requires UUID identifiers for assignment-owned resources', () => {
    const parsed = ChurchPastorAssignSchema.safeParse({
      assigned: [{ pastorId: 'p1', imageAssetId: 'asset1', activeVoiceProfileId: 'voice1' }],
    })
    expect(parsed.success).toBe(false)
  })

  it('uses the documented pastor subject for church-scoped read and update', () => {
    const catalogue = expandPrayerCatalogue()
    const churchAdmin = PRAYER_ROLES.find(({ name }) => name === 'prayer_church_admin')

    expect(catalogue.some(({ subject }) => subject === 'prayer_church_pastor')).toBe(false)
    expect(churchAdmin?.grants).toContainEqual({
      subject: 'prayer_pastor',
      actions: 'read,update',
      scope: 'ANY',
    })
  })
})
