import { RoleDataModel } from '@/models/role'

type GrantRule = {
  possession: 'any' | 'own'
  attributes: string[]
}

type PermissionMap = {
  [subject: string]: {
    [action: string]: GrantRule[]
  }
}

export const TransformRoleToAccessControl = ({ role }: { role: RoleDataModel }) => {
  const result = {
    [role.name]: role.permission.reduce<PermissionMap>((acc, perm) => {
      const action = perm.actions
      const possession = (perm.scope.toLowerCase() === 'own' ? 'own' : 'any') as 'any' | 'own'

      // Ensure `acc[perm.subject]` exists
      if (!acc[perm.subject]) {
        acc[perm.subject] = {}
      }

      // Add or update the permission (v3 format: action → array of grant rules)
      acc[perm.subject][action] = [{ possession, attributes: ['*'] }]
      return acc
    }, {}),
  }

  return result
}

export const TransformRolesToAccessControl = ({ roles }: { roles: RoleDataModel[] }) => {
  type AccessControl = {
    [roleName: string]: PermissionMap
  }

  const result = roles.reduce<AccessControl>((acc, role) => {
    acc[role.name] = role.permission.reduce<PermissionMap>((permAcc, perm) => {
      const action = perm.actions
      const possession = (perm.scope.toLowerCase() === 'own' ? 'own' : 'any') as 'any' | 'own'

      // Ensure `permAcc[perm.subject]` exists
      if (!permAcc[perm.subject]) {
        permAcc[perm.subject] = {}
      }

      // Add or update the permission (v3 format: action → array of grant rules)
      permAcc[perm.subject][action] = [{ possession, attributes: ['*'] }]
      return permAcc
    }, {})

    return acc
  }, {})

  return result
}
