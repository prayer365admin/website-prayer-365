import UploadBox from '@/components/common/upload-box'
import PasswordInput from '@/components/common/password-input'
import SelectRole from '@/components/common/select/role'
import { UserFormModel } from '@/models/user'
import { Button, Divider, Form, Input } from 'antd'
import { useState } from 'react'

export default function FormUser({
  initialValues,
  onSubmit,
  type = 'CREATE',
}: {
  initialValues?: UserFormModel
  onSubmit: (payload: UserFormModel) => Promise<void>
  type?: 'CREATE' | 'EDIT'
}) {
  const [form] = Form.useForm<UserFormModel>()
  const [password, setPassword] = useState<boolean>(type === 'EDIT')
  const [upload, setUpload] = useState<{ url: string | null }>({
    url: initialValues?.profile_picture ?? null,
  })

  const handleSubmit = async () => {
    const payload = await form.validateFields()
    await onSubmit(payload)
  }

  return (
    <div>
      <div className="w-[50%]">
        <Form layout="vertical" initialValues={initialValues} form={form}>
          <UploadBox
            formName="profile_picture"
            label="Profile Picture"
            initialData={initialValues?.profile_picture ?? null}
            upload={upload}
            setUpload={setUpload}
            width="120px"
            height="120px"
          />
          <Form.Item name={'email'} label="Email">
            <Input placeholder="Ex. admin@catatia.com" />
          </Form.Item>
          <Form.Item name={'name'} label="Name">
            <Input placeholder="Ex. Administrator" />
          </Form.Item>
          <SelectRole name="role_id" label="Role" />
          <Divider>Password</Divider>
          {type === 'EDIT' && (
            <div className="text-right">
              <Button
                onClick={() => {
                  form.setFieldsValue({ password: '' })
                  setPassword(!password)
                }}
              >
                Change Password
              </Button>
            </div>
          )}
          <PasswordInput label="Password" disabled={password} required={false} />
        </Form>
      </div>
      <Button onClick={handleSubmit} type="primary">
        Submit
      </Button>
    </div>
  )
}
