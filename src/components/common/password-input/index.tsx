import { Form, Input } from 'antd'

export default function PasswordInput({
  required,
  label,
  disabled,
}: {
  required?: boolean
  label: string
  disabled?: boolean
}) {
  return (
    <>
      <Form.Item
        label={label}
        name={'password'}
        rules={[
          { required: required, message: `Please input your ${label}!` },
          () => ({
            validator(_, value) {
              if (disabled) {
                return Promise.resolve()
              }

              const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
              if (!value || !regex.test(value)) {
                return Promise.reject(new Error(`${label} only able to use numbers!`))
              }

              return Promise.resolve()
            },
          }),
        ]}
        hasFeedback
      >
        <Input.Password placeholder={label} disabled={disabled} />
      </Form.Item>
      <Form.Item
        label={`Confirm ${label}`}
        name={'confirm_password'}
        dependencies={['password']}
        hasFeedback
        rules={[
          { required: required, message: `Please confirm your ${label}!` },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve()
              }
              return Promise.reject(new Error(`The new ${label} that you entered do not match!`))
            },
          }),
        ]}
      >
        <Input.Password placeholder="Password" disabled={disabled} />
      </Form.Item>
    </>
  )
}
