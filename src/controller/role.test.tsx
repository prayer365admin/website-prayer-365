import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  GET_ROLE_BY_ID: vi.fn(),
  GET_ROLE_BY_NAME: vi.fn(),
  CREATE_ROLE: vi.fn(),
  UPDATE_ROLE: vi.fn(),
  DELETE_ROLE: vi.fn(),
  COUNT_ROLE_USAGE: vi.fn(),
  auditCreate: vi.fn(),
}))

vi.mock('@/providers/role', () => ({
  GET_ROLE_BY_ID: m.GET_ROLE_BY_ID,
  GET_ROLE_BY_NAME: m.GET_ROLE_BY_NAME,
  CREATE_ROLE: m.CREATE_ROLE,
  UPDATE_ROLE: m.UPDATE_ROLE,
  DELETE_ROLE: m.DELETE_ROLE,
  COUNT_ROLE_USAGE: m.COUNT_ROLE_USAGE,
}))

vi.mock('@/utils/db-transaction', () => ({
  dbTransaction: (fn: (tx: unknown) => unknown) => fn({ auditLog: { create: m.auditCreate } }),
}))

import { createRole, deleteRole, updateRole } from './role'

const admin = { id: 'r-admin', name: 'administrator', type: 'SYSTEM', permission: [] }
const systemRole = { id: 'r-sys', name: 'prayer_church_admin', type: 'SYSTEM', permission: [] }
const userRole = { id: 'r-user', name: 'auditor', type: 'USER', permission: [] }

describe('createRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a USER role with the selected permissions and audits it', async () => {
    m.GET_ROLE_BY_NAME.mockResolvedValue(null)
    m.CREATE_ROLE.mockResolvedValue({ id: 'r-new', name: 'auditor' })

    const result = await createRole({
      payload: { name: ' auditor ', permission_list: { p1: true, p2: false } },
      actorId: 'actor',
      requestId: 'req',
    })

    expect(m.CREATE_ROLE).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'auditor',
        type: 'USER',
        permission: { connect: [{ id: 'p1' }] },
      }),
      expect.anything(),
    )
    expect(m.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'role.create', resource_id: 'r-new' }),
      }),
    )
    expect(result).toMatchObject({ id: 'r-new' })
  })

  it('rejects a duplicate name with 409', async () => {
    m.GET_ROLE_BY_NAME.mockResolvedValue({ id: 'x', name: 'auditor', type: 'USER' })
    await expect(
      createRole({ payload: { name: 'auditor' }, actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'ROLE_EXISTS' })
  })

  it('refuses to create a second super-admin role', async () => {
    await expect(
      createRole({ payload: { name: 'administrator' }, actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 403, error_code: 'ROLE_LOCKED' })
  })
})

describe('updateRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses to edit the super-admin role (it keeps every permission)', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(admin)
    await expect(
      updateRole({
        role_id: 'r-admin',
        payload: { name: 'administrator', permission_list: {} },
        actorId: 'actor',
        requestId: 'req',
      }),
    ).rejects.toMatchObject({ code: 403, error_code: 'ROLE_LOCKED' })
    expect(m.UPDATE_ROLE).not.toHaveBeenCalled()
  })

  it('refuses to rename a SYSTEM role', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(systemRole)
    await expect(
      updateRole({
        role_id: 'r-sys',
        payload: { name: 'renamed', permission_list: {} },
        actorId: 'actor',
        requestId: 'req',
      }),
    ).rejects.toMatchObject({ code: 409, error_code: 'SYSTEM_ROLE_RENAME' })
  })

  it('re-permissions a SYSTEM role without renaming it', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(systemRole)
    m.UPDATE_ROLE.mockResolvedValue({ id: 'r-sys' })

    await updateRole({
      role_id: 'r-sys',
      payload: { name: 'prayer_church_admin', permission_list: { p1: true } },
      actorId: 'actor',
      requestId: 'req',
    })

    expect(m.UPDATE_ROLE).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'r-sys', type: 'SYSTEM' }),
      expect.anything(),
    )
    expect(m.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'role.update' }) }),
    )
  })

  it('404s an unknown role', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(null)
    await expect(
      updateRole({ role_id: 'nope', payload: {}, actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 404, error_code: 'ROLE_NOT_FOUND' })
  })
})

describe('deleteRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuses SYSTEM roles', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(systemRole)
    await expect(
      deleteRole({ role_id: 'r-sys', actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'SYSTEM_ROLE' })
  })

  it('refuses a role that is still bound to users or assignments', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(userRole)
    m.COUNT_ROLE_USAGE.mockResolvedValue({ users: 2, assignments: 0 })
    await expect(
      deleteRole({ role_id: 'r-user', actorId: 'actor', requestId: 'req' }),
    ).rejects.toMatchObject({ code: 409, error_code: 'ROLE_IN_USE' })
    expect(m.DELETE_ROLE).not.toHaveBeenCalled()
  })

  it('deletes an unused USER role and audits it', async () => {
    m.GET_ROLE_BY_ID.mockResolvedValue(userRole)
    m.COUNT_ROLE_USAGE.mockResolvedValue({ users: 0, assignments: 0 })
    m.DELETE_ROLE.mockResolvedValue({ id: 'r-user' })

    await deleteRole({ role_id: 'r-user', actorId: 'actor', requestId: 'req' })

    expect(m.DELETE_ROLE).toHaveBeenCalled()
    expect(m.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'role.delete' }) }),
    )
  })
})
