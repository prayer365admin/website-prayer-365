import { RoleDataModel } from '@/models/role'

export const TransformRoleToAccessControl = ({ role }: { role: RoleDataModel }) => {
  type PermissionMap = {
    [subject: string]: {
      [actionScope: string]: string[]
    }
  }

  const result = {
    [role.name]: role.permission.reduce<PermissionMap>((acc, perm) => {
      const key = `${perm.actions}:${perm.scope.toLowerCase()}`

      // Ensure `acc[perm.subject]` exists
      if (!acc[perm.subject]) {
        acc[perm.subject] = {}
      }

      // Add or update the permission
      acc[perm.subject][key] = ['*']
      return acc
    }, {}),
  }

  return result
}

export const TransformRolesToAccessControl = ({ roles }: { roles: RoleDataModel[] }) => {
  type PermissionMap = {
    [subject: string]: {
      [actionScope: string]: string[]
    }
  }

  type AccessControl = {
    [roleName: string]: PermissionMap
  }

  const result = roles.reduce<AccessControl>((acc, role) => {
    acc[role.name] = role.permission.reduce<PermissionMap>((permAcc, perm) => {
      const key = `${perm.actions}:${perm.scope.toLowerCase()}`

      // Ensure `permAcc[perm.subject]` exists
      if (!permAcc[perm.subject]) {
        permAcc[perm.subject] = {}
      }

      // Add or update the permission
      permAcc[perm.subject][key] = ['*']
      return permAcc
    }, {})

    return acc
  }, {})

  return result
}
