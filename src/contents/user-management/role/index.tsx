'use client'

import AddButton from '@/components/common/add-button'
import { useRoles } from '@/hooks/data/role'
import { Table } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment } from 'react'
import { RoleColumns } from './columns'

export default function ContentsUserManagementRole() {
  const { data: roleData, onDelete: deleteRole, loading: roleLoading } = useRoles({})
  const columns = RoleColumns({ onDelete: deleteRole })
  const router = useRouter()

  return (
    <Fragment>
      <div>
        <AddButton
          label="Create Role"
          onClick={() => {
            router.push('/dashboard/user-management/role/create')
          }}
          permissionSubject="user_management_role"
        />
        <Table
          dataSource={roleData}
          columns={columns}
          loading={roleLoading}
          rowKey={'id'}
          key={'role-table'}
        />
      </div>
    </Fragment>
  )
}
