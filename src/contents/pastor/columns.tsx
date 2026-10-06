import ActionsTable from '@/components/common/actions-table'
import PastorImage from '@/components/common/pastor-image'
import { PastorData } from '@/models/pastor'
import { ACTION_COLUMN_WIDTH, ADDITIONAL_COLUMN_CONFIG, ID_COLUMN_WIDTH } from '@/utils/constant'
import { TableProps, Tag } from 'antd'
import { useRouter } from 'next/navigation'

export const PastorColumns = ({
  page,
  pageSize,
  onDelete,
}: {
  page: number
  pageSize: number
  onDelete: (pastorId: string) => void
}) => {
  const router = useRouter()
  const columns: TableProps<PastorData>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,
      render: (_text, _record, index) =>
        (index + 1 + (page - 1) * pageSize).toString().padStart(2, '0'),
    },
    { key: 'name', title: 'Name', sorter: true, render: (_, { name }) => name },
    {
      key: 'image',
      title: 'Image',
      width: 80,
      render: (_, pastor) => (
        <PastorImage
          imageAssetId={pastor.imageAssetId}
          churchId={pastor.imageChurchId}
          name={pastor.name}
        />
      ),
    },
    {
      key: 'introduction',
      title: 'Introduction',
      width: 400,
      sorter: true,
      ellipsis: { showTitle: true },
      render: (_, { introduction }) => (
        <span className="block max-w-[400px] truncate" title={introduction ?? undefined}>
          {introduction ?? '—'}
        </span>
      ),
    },
    {
      key: 'staff_account',
      title: 'Staff Account',
      sorter: true,
      render: (_, { user }) =>
        user ? (
          <div>
            <div>{user.name}</div>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
        ) : (
          <Tag color="blue" variant="solid">
            Not linked
          </Tag>
        ),
    },
    {
      key: 'churches',
      title: 'Churches',
      sorter: true,
      render: (_, { churches }) =>
        churches.length ? (
          <div className="flex flex-wrap gap-1">
            {churches.map((church) => (
              <Tag key={church.churchId}>{church.churchName}</Tag>
            ))}
          </div>
        ) : (
          <Tag color="blue" variant="solid">
            Not assigned
          </Tag>
        ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: ACTION_COLUMN_WIDTH,
      ...ADDITIONAL_COLUMN_CONFIG,
      render: (_, record) => (
        <ActionsTable
          entity="pastor"
          details={record.name}
          actions="deleting"
          permissionSubject="prayer_pastor"
          onEdit={() => router.push('/dashboard/central/pastors/' + record.id)}
          onDelete={() => onDelete(record.id)}
        />
      ),
    },
  ]
  return columns
}
