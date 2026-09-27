import { Form, InputNumber } from 'antd'

export default function PriceInput({
  name,
  label,
  required = false,
}: {
  name: string
  label: string
  required: boolean
}) {
  return (
    <Form.Item
      label={label}
      name={name}
      noStyle
      rules={[
        {
          required: required,
          message: `${label} is required`,
        },
      ]}
    >
      <InputNumber<number>
        style={{ width: '100%' }}
        placeholder={`Input ${label}`}
        min={0}
        maxLength={13}
        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
        parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
      />
    </Form.Item>
  )
}
