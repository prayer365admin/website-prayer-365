import { useChurchPastors } from '@/hooks/data/pastor'
import { Form, Select } from 'antd'
import type { SelectProps } from 'antd'

export default function SelectPastor({
  name,
  label,
  churchId,
  disabled = false,
  size,
  className,
}: {
  name: string
  label: string
  churchId: string
  disabled?: boolean
  size?: SelectProps['size']
  className?: string
}) {
  const { data: pastorData, loading: pastorLoading } = useChurchPastors(churchId)
  return (
    <Form.Item
      name={name}
      label={label}
      rules={[{ required: true, message: 'Pastor is required.' }]}
    >
      <Select
        disabled={disabled}
        className={className}
        size={size}
        placeholder="Select Pastor"
        loading={pastorLoading}
        options={pastorData?.map((item) => ({ value: item.id, label: item.name }))}
      />
    </Form.Item>
  )
}
