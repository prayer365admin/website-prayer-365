import { RoleDataModel } from '@/models/role'
import { TransformRoleToAccessControl } from '@/utils/role-to-access-control'
import { AccessControl } from 'accesscontrol'
import { useSession } from 'next-auth/react'
import { useRole } from './role'

export const useAccessPermission = () => {
  const { data: session } = useSession()
  const { data: role } = useRole(session?.user.role?.id)

  const grantObject = TransformRoleToAccessControl({
    role: role
      ? role
      : ({
          name: 'non-user',
          permission: [{ subject: 'nothing', actions: 'read', scope: 'ANY' }],
        } as RoleDataModel),
  })
  const accessPermission = new AccessControl(grantObject)
  const permission = accessPermission.can(role ? role.name : 'non-user')

  return permission
}
