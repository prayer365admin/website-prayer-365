import ActionsTable from '@/components/common/actions-table'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { RoleDataModel } from '@/models/role'
import { ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG, ID_COLUMN_WIDTH } from '@/utils/constant'
import { TableProps, Tag } from 'antd'
import { useRouter } from 'next/navigation'

export const RoleColumns = ({ onDelete }: { onDelete: (id: string) => void }) => {
  const router = useRouter()
  const permission = useAccessPermission()
  const havePermission =
    permission.updateAny('user_management_role').granted ||
    permission.deleteAny('user_management_role').granted

  const column: TableProps<RoleDataModel>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,
      render: (_text, _record, index) => (index + 1).toString().padStart(2, '0'),
    },
    { key: 'name', dataIndex: 'name', title: 'Name', render: (text) => text },
    {
      key: 'type',
      title: 'Type',
      render: (_text, record) => (
        <Tag color={record.type === 'SYSTEM' ? 'default' : 'blue'}>{record.type}</Tag>
      ),
    },
    ...(havePermission
      ? [
          {
            key: 'actions',
            title: 'Actions',
            width: ACTION_COLUMN_WIDTH,
            ...ADDITIONAL_COLUMN_CONFIG,
            render: (_text: string, record: RoleDataModel) => {
              return (
                <ActionsTable
                  entity="role"
                  details={record.name}
                  actions="deleting"
                  onEdit={() => {
                    router.push(`/dashboard/user-management/role/${record.id}`)
                  }}
                  onDelete={() => {
                    onDelete(record.id)
                  }}
                  permissionSubject="user_management_role"
                />
              )
            },
          },
        ]
      : []),
  ]

  return column
}
