'use client'

import { Fragment } from 'react'
import { useRole } from '@/hooks/data/role'
import { RolePayloadUpdateModel } from '@/models/role'
import { useParams } from 'next/navigation'
import MainNotification from '@/components/common/notifications'
import FormRole from '@/components/common/form/role'
import { Card, Skeleton } from 'antd'
import CardTitle from '@/components/common/card-title'

export default function ContentsUserManagementRoleEdit() {
  const { id }: { id: string } = useParams()
  const { onUpdate: updateRole, data: roleData, loading: roleLoading } = useRole(id)

  const handleCreateRole = async (payload: RolePayloadUpdateModel) => {
    try {
      await updateRole(payload)
    } catch (_e) {
      MainNotification({ type: 'error', entity: 'role', action: 'updated' })
    }
  }

  return (
    <Fragment>
      <Card title={<CardTitle title="Update Role" />}>
        {roleData && !roleLoading ? (
          <FormRole onSubmit={handleCreateRole} initialValues={roleData} />
        ) : (
          <Skeleton />
        )}
      </Card>
    </Fragment>
  )
}
