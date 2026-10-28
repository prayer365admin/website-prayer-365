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

              // Empty input is the `required` rule's message — don't stack a second one.
              if (!value) {
                return Promise.resolve()
              }

              const regex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
              if (!regex.test(value)) {
                return Promise.reject(
                  new Error(
                    `${label} must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a symbol (@$!%*?&).`,
                  ),
                )
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
              return Promise.reject(new Error(`${label} and confirmation do not match!`))
            },
          }),
        ]}
      >
        <Input.Password placeholder="Password" disabled={disabled} />
      </Form.Item>
    </>
  )
}
