'use client'

import CardTitle from '@/components/common/card-title'
import FormUser from '@/components/common/form/user'
import { useUsers } from '@/hooks/data/user'
import { UserPayloadCreateModel } from '@/models/user'
import { Card } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment } from 'react'

export default function ContentsUserManagementUserCreate() {
  const router = useRouter()
  const { onCreate: createUser } = useUsers({})

  const handleSubmit = async (payload: UserPayloadCreateModel) => {
    await createUser(payload)
    router.back()
  }

  return (
    <Fragment>
      <Card title={<CardTitle title="Create User" />}>
        <FormUser onSubmit={handleSubmit} />
      </Card>
    </Fragment>
  )
}
