import { useRoles } from '@/hooks/data/role'
import { Select } from 'antd'

export default function RoleFilter({
  value,
  setValue,
  placeholder = 'Filter by Role',
  className,
}: {
  value?: string
  setValue: (v?: string) => void
  placeholder?: string
  className?: string
}) {
  const { data: roleData, loading: roleLoading } = useRoles({})
  return (
    <Select
      className={className}
      placeholder={placeholder}
      allowClear
      loading={roleLoading}
      value={value}
      onChange={(v) => setValue(v)}
      options={roleData?.map((item) => {
        return {
          value: item.id,
          label: item.name,
        }
      })}
    />
  )
}
