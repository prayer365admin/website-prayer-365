import { useRoles } from '@/hooks/data/role'
import { Select } from 'antd'

export default function RoleFilter({
  value,
  setValue,
}: {
  value?: string
  setValue: (v?: string) => void
}) {
  const { data: roleData, loading: roleLoading } = useRoles({})
  return (
    <Select
      placeholder="Filter by Role"
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
