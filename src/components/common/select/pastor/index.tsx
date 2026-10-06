import { useChurchPastors } from '@/hooks/data/pastor'
import { Form, Select } from 'antd'

export default function SelectPastor({
  name,
  label,
  churchId,
}: {
  name: string
  label: string
  churchId: string
}) {
  const { data: pastorData, loading: pastorLoading } = useChurchPastors(churchId)
  return (
    <Form.Item
      name={name}
      label={label}
      rules={[{ required: true, message: 'Pastor is required.' }]}
    >
      <Select
        placeholder="Select Pastor"
        loading={pastorLoading}
        options={pastorData?.map((item) => ({ value: item.id, label: item.name }))}
      />
    </Form.Item>
  )
}
