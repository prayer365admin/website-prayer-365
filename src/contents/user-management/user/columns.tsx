import { UserDataModel } from '@/models/user'
import { Avatar, Button, Space, TableProps, Tag } from 'antd'

export const chipColor = (roleName?: string | null): { backgroundColor: string; color: string } => {
  if (!roleName) return { backgroundColor: '#FAFAFB', color: '#5C6370' }
  const lower = roleName.toLowerCase()
  if (lower === 'prayer_global_admin' || lower.includes('admin')) {
    return { backgroundColor: '#F1EDFD', color: '#230679' }
  }
  if (lower.includes('country_admin') || lower.includes('diocese') || lower.includes('registrar')) {
    return { backgroundColor: '#F5F7FF', color: '#2555A7' }
  }
  if (lower.includes('pastor') || lower.includes('church_admin') || lower.includes('lead')) {
    return { backgroundColor: '#EDFDF9', color: '#067958' }
  }
  return { backgroundColor: '#FAFAFB', color: '#5C6370' }
}

export const kindLabel = (kind?: string | null): string => {
  if (!kind) return '—'
  const mapping: Record<string, string> = {
    COUNTRY: 'Country',
    DIOCESE: 'Diocese',
    DEANERY: 'Deanery',
    CHURCH: 'Church',
    GLOBAL: 'Global',
  }
  return mapping[kind] ?? kind.charAt(0) + kind.slice(1).toLowerCase()
}

export function relativeTime(iso?: string | Date | null): string {
  if (!iso) return '—'
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const time = date.getTime()
  if (Number.isNaN(time)) return '—'
  const diffSec = Math.floor((Date.now() - time) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' })
  if (diffSec < 60) {
    return rtf.format(-1, 'minute')
  }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute')
  }
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) {
    return rtf.format(-diffHours, 'hour')
  }
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return rtf.format(-diffDays, 'day')
  }
  return date.toLocaleDateString()
}

export const UserColumns = ({
  onEdit,
  onDelete: _onDelete,
}: {
  onEdit: (id: string) => void
  onDelete?: (id: string) => void
}) => {
  const column: TableProps<UserDataModel>['columns'] = [
    {
      key: 'staff',
      title: 'Staff Member',
      width: 308,
      render: (_text, record) => {
        const initial = record.name?.[0]?.toUpperCase() ?? 'U'
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
      key: 'role',
      title: 'Role',
      width: 140,
      render: (_text, record) => (
        <Tag
          className="rounded border-0 font-medium !text-[10px] !py-0.5 !px-1.5 !leading-[15px]"
          style={chipColor(record.role?.name)}
        >
          {record.role?.name ?? '—'}
        </Tag>
      ),
    },
    {
      key: 'jurisdiction',
      title: 'Jurisdictions',
      width: 240,
      render: (_text, record) => {
        const assignment = record.role_assignments?.[0] ?? record.roleAssignments?.[0]
        const orgName = assignment?.org_node?.name
        const orgKind = assignment?.org_node?.kind

        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[#2555A7]">
              {orgName ?? 'No jurisdiction'}
            </span>
            {orgName && <span className="text-xs text-[#727783]">{kindLabel(orgKind)}</span>}
          </div>
        )
      },
    },
    {
      key: 'login_with',
      title: 'Login with',
      width: 160,
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
      width: 104,
      render: (_text, record) => {
        const isActive = record.status === 'active' && !record.deleted_at
        if (isActive) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D3FAEF] bg-[#EDFDF9] px-2.5 py-1 text-xs font-semibold text-[#09A97C]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#09A97C]" />
              Active
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FBEEC6] bg-[#FEFCF6] px-2.5 py-1 text-xs font-semibold text-[#D8A50E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D8A50E]" />
            Inactive
          </span>
        )
      },
    },
    {
      key: 'last_active',
      title: 'Last Active',
      width: 96,
      render: (_text, record) => (
        <span className="text-sm text-[#5C6370]">{relativeTime(record.last_active_at)}</span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 120,
      render: (_text, record) => (
        <Button
          type="text"
          className="!px-2 !text-[#2F7AD2] !font-semibold"
          onClick={() => {
            onEdit(record.id)
          }}
        >
          Edit
        </Button>
      ),
    },
  ]

  return column
}
