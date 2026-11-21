import { relativeTime } from '@/contents/user-management/user/columns'
import { StatusPill } from '@/contents/churches/donations/status-pill'
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
              <span className="text-sm font-semibold text-[var(--color-primary-900)]">
                {record.name}
              </span>
              <span className="text-xs text-[var(--color-donation-body)]">{record.email}</span>
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
          style={{ backgroundColor: 'var(--color-primary-100)', color: 'var(--color-primary-650)' }}
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
        <span className="text-sm text-[var(--color-neutral-700)]">
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
        if (record.deleted_at) return <StatusPill label="Deleted" tone="danger" />
        if (record.status === 'deletion_pending') {
          return <StatusPill label="Deletion pending" tone="warning" />
        }
        return record.email_verified_at ? (
          <StatusPill label="Verified" tone="success" />
        ) : (
          <StatusPill label="Unverified" tone="neutral" />
        )
      },
    },
    {
      key: 'deletion_requested_at',
      title: 'Deletion Request',
      width: 280,
      minWidth: 260,
      render: (_text, record) => {
        if (!record.deletion_requested_at)
          return <span className="text-sm text-[var(--color-donation-body)]">—</span>
        const ends = record.deletion_grace_ends_at
        return (
          <div className="flex flex-col">
            <span className="text-sm text-[var(--color-neutral-700)]">
              {formatDateTime(record.deletion_requested_at)}
            </span>
            {ends && !record.deleted_at && (
              <span className="text-xs text-[var(--color-donation-warning-strong)]">
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
        <span className="text-sm text-[var(--color-donation-body)]">
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
        <span className="text-sm text-[var(--color-donation-body)]">
          {relativeTime(record.last_active_at)}
        </span>
      ),
    },
  ]

  return column
}
