'use client'

import CardTitle from '@/components/common/card-title'
import FormUser from '@/components/common/form/user'
import { useUser } from '@/hooks/data/user'
import { UserPayloadUpdateModel } from '@/models/user'
import { Card, Skeleton } from 'antd'
import { useParams, useRouter } from 'next/navigation'
import { Fragment } from 'react'
import ScopeAssignments from './scope-assignments'

export default function ContentsUserManagementUserEdit() {
  const { id } = useParams()
  const { data: userData, onUpdate: updateUser } = useUser(`${id}`)
  const router = useRouter()

  const handleSubmit = async (payload: UserPayloadUpdateModel) => {
    if (!payload.password) {
      delete payload.password
    }
    await updateUser(payload)
    router.back()
  }

  return (
    <Fragment>
      <Card title={<CardTitle title="Update User" />}>
        {userData ? (
          <FormUser
            onSubmit={handleSubmit}
            initialValues={{ ...userData, password: undefined }}
            type="EDIT"
          />
        ) : (
          <Skeleton />
        )}
      </Card>
      <ScopeAssignments userId={`${id}`} />
    </Fragment>
  )
}
