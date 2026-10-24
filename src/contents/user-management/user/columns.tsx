import ActionsTable from '@/components/common/actions-table'
import { UserDataModel } from '@/models/user'
import { ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG, ID_COLUMN_WIDTH } from '@/utils/constant'
import { TableProps, Tag } from 'antd'
import { useRouter } from 'next/navigation'

export const UserColumns = ({ onDelete }: { onDelete: (id: string) => void }) => {
  const router = useRouter()
  const column: TableProps<UserDataModel>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,

      render: (_text, _record, index) => (index + 1).toString().padStart(2, '0'),
    },
    { key: 'name', dataIndex: 'name', title: 'Name', sorter: true, render: (text) => text },
    {
      key: 'role-name',
      dataIndex: 'role[name]',
      title: 'Role Name',
      render: (text, record) => record.role?.name ?? '-',
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: 'Status',
      // Plan 023: accounts are deactivated, not deleted, so their state matters here.
      render: (_text, record) => (
        <Tag color={record.status === 'active' && !record.deleted_at ? 'green' : 'default'}>
          {record.status === 'active' && !record.deleted_at ? 'active' : 'inactive'}
        </Tag>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: ACTION_COLUMN_WIDTH,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_text, record) => {
        return (
          <ActionsTable
            entity="user"
            details={record.name}
            // Deactivate (soft delete) — the label drives the confirm modal wording.
            actions="deactivating"
            permissionSubject="user_management_user"
            onEdit={() => {
              router.push(`/dashboard/user-management/user/${record.id}`)
            }}
            onDelete={() => {
              onDelete(record.id)
            }}
          />
        )
      },
    },
  ]

  return column
}
