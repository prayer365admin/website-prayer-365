'use client'

import CardTitle from '@/components/common/card-title'
import FormRole from '@/components/common/form/role'
import MainNotification from '@/components/common/notifications'
import { useRoles } from '@/hooks/data/role'
import { RolePayloadCrateModel } from '@/models/role'
import { Card } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment } from 'react'

export default function ContentsUserManagementRoleCreate() {
  const router = useRouter()
  const { onCreate: createRole } = useRoles({})

  const handleCreateRole = async (payload: RolePayloadCrateModel) => {
    try {
      await createRole(payload)
      router.back()
    } catch (_e) {
      MainNotification({ type: 'error', entity: 'role', action: 'create' })
    }
  }

  return (
    <Fragment>
      <Card title={<CardTitle title="Create Role" />}>
        <FormRole onSubmit={handleCreateRole} />
      </Card>
    </Fragment>
  )
}
