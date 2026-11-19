import { relativeTime } from '@/contents/user-management/user/columns'
import { CustomerDataModel } from '@/hooks/data/customer'
import { Avatar, Space, TableProps, Tag } from 'antd'

const formatDateTime = (v: string) =>
  new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** "13 Days 4 Hours 12 Minutes": leading zero units dropped, seconds never shown. */
export const formatCountdown = (endsAt: string, now = Date.now()) => {
  const mins = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  const parts = [d && unit(d, 'Day'), (d || h) && unit(h, 'Hour'), unit(m, 'Minute')]
  return parts.filter(Boolean).join(' ')
}

export const CustomerColumns = ({
  page: _page,
  pageSize: _pageSize,
}: {
  page?: number
  pageSize?: number
} = {}): TableProps<CustomerDataModel>['columns'] => {
  const column: TableProps<CustomerDataModel>['columns'] = [
    {
      key: 'customer',
      title: 'Customer',
      minWidth: 260,
      sorter: true,
      dataIndex: 'name',
      render: (_text, record) => {
        const initial = record.name?.[0]?.toUpperCase() ?? 'C'
        return (
          <Space size={8}>
            <Avatar src={record.avatarUrl ?? record.profile_picture} size={40}>
              {initial}
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[#0E203E]">{record.name}</span>
              <span className="text-xs text-[#5C6370]">{record.email}</span>
            </div>
          </Space>
        )
      },
    },
    {
      key: 'type',
      title: 'Type',
      width: 120,
      minWidth: 100,
      render: () => (
        <Tag
          className="rounded border-0 font-medium !text-[10px] !py-0.5 !px-1.5 !leading-[15px]"
          style={{ backgroundColor: '#F5F7FF', color: '#2555A7' }}
        >
          Customer
        </Tag>
      ),
    },
    {
      key: 'login_with',
      title: 'Login with',
      width: 160,
      minWidth: 150,
      render: (_text, record) => (
        <span className="text-sm text-[#393E46]">
          {record.last_login_provider === 'google'
            ? 'Google'
            : record.last_login_provider === 'password'
              ? 'Email & Password'
              : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      width: 160,
      minWidth: 150,
      render: (_text, record) => {
        if (record.deleted_at) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FAD3D3] bg-[#FEF2F2] px-2.5 py-1 text-xs font-semibold text-[#D83A3A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D83A3A]" />
              Deleted
            </span>
          )
        }
        if (record.status === 'deletion_pending') {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FFE58F] bg-[#FFFBE6] px-2.5 py-1 text-xs font-semibold text-[#AD6800]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FAAD14]" />
              Deletion pending
            </span>
          )
        }
        const isVerified = Boolean(record.email_verified_at)
        if (isVerified) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D3FAEF] bg-[#EDFDF9] px-2.5 py-1 text-xs font-semibold text-[#09A97C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#09A97C]" />
              Verified
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBEEC6] bg-[#FEFCF6] px-2.5 py-1 text-xs font-semibold text-[#D8A50E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D8A50E]" />
            Unverified
          </span>
        )
      },
    },
    {
      key: 'deletion_requested_at',
      title: 'Deletion Request',
      width: 280,
      minWidth: 260,
      render: (_text, record) => {
        if (!record.deletion_requested_at) return <span className="text-sm text-[#5C6370]">—</span>
        const ends = record.deletion_grace_ends_at
        return (
          <div className="flex flex-col">
            <span className="text-sm text-[#393E46]">
              {formatDateTime(record.deletion_requested_at)}
            </span>
            {ends && !record.deleted_at && (
              <span className="text-xs text-[#AD6800]">
                {formatCountdown(ends)} on {formatDateTime(ends)}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'created_at',
      title: 'Registered',
      width: 140,
      minWidth: 130,
      sorter: true,
      dataIndex: 'created_at',
      render: (text?: string) => (
        <span className="text-sm text-[#5C6370]">
          {text ? new Date(text).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'last_active',
      title: 'Last Active',
      width: 130,
      minWidth: 120,
      render: (_text, record) => (
        <span className="text-sm text-[#5C6370]">{relativeTime(record.last_active_at)}</span>
      ),
    },
  ]

  return column
}
