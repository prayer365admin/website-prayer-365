import { GET_ROLES } from '@/providers/role'
import { AccessControl } from 'accesscontrol'
import { TransformRolesToAccessControl } from './role-to-access-control'

export const getAccessPermission = async () => {
  const roleList = await GET_ROLES()

  const grantObject = TransformRolesToAccessControl({ roles: roleList })

  const accessPermission = new AccessControl(grantObject)

  return accessPermission
}
