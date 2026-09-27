import { useRoles } from '@/hooks/data/role'
import { Form, Select } from 'antd'

export default function SelectRole({ name, label }: { name: string; label: string }) {
  const { data: roleData, loading: roleLoading } = useRoles({})
  return (
    <Form.Item name={name} label={label}>
      <Select
        placeholder="Select Role"
        loading={roleLoading}
        options={roleData?.map((item) => {
          return {
            value: item.id,
            label: item.name,
          }
        })}
      />
    </Form.Item>
  )
}
