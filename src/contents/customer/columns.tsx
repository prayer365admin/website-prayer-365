import { ID_COLUMN_WIDTH } from '@/utils/constant'
import { TableProps, Tag } from 'antd'

type CustomerRow = {
  id: string
  email: string
  name: string
  created_at: string
}

export const CustomerColumns = (): TableProps<CustomerRow>['columns'] => {
  const column: TableProps<CustomerRow>['columns'] = [
    {
      key: 'no',
      title: 'No.',
      width: ID_COLUMN_WIDTH,
      render: (_text, _record, index) => (index + 1).toString().padStart(2, '0'),
    },
    { key: 'name', dataIndex: 'name', title: 'Name', render: (text) => text },
    { key: 'email', dataIndex: 'email', title: 'Email', render: (text) => text },
    {
      key: 'status',
      title: 'Type',
      render: () => <Tag color="blue">Customer</Tag>,
    },
    {
      key: 'created_at',
      dataIndex: 'created_at',
      title: 'Registered',
      render: (text: string) => (text ? new Date(text).toLocaleDateString() : '-'),
    },
  ]

  return column
}
