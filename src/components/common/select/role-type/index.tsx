import { RoleTypeData } from '@/data/role-type'
import { Form, Select } from 'antd'

export default function SelectRoleStatus({ name, label }: { name: string; label: string }) {
  return (
    <Form.Item name={name} label={label}>
      <Select placeholder="Select role status" options={RoleTypeData} />
    </Form.Item>
  )
}
