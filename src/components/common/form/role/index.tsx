import { usePermissions } from '@/hooks/data/permission'
import { PermissionDataModel } from '@/models/permission'
import { RoleDataModel, RoleFormModel } from '@/models/role'
import { toCapitalized } from '@/utils/capitalized'
import { Button, Divider, Form, Input, Switch } from 'antd'
import SelectRoleStatus from '@/components/common/select/role-type'

export default function FormRole({
  initialValues,
  onSubmit,
}: {
  initialValues?: RoleDataModel
  onSubmit: (payload: RoleFormModel) => Promise<void>
}) {
  const [form] = Form.useForm<RoleFormModel>()
  const [permissionForm] = Form.useForm<{ [key: string]: boolean }>()

  const { data: permissionData } = usePermissions()

  const handleSubmit = async () => {
    const payload = await form.validateFields()
    const permissionPayload = await permissionForm.validateFields()

    const finalPayload = { ...payload, permission_list: permissionPayload }
    await onSubmit(finalPayload)
  }

  const groupPermissionData =
    permissionData &&
    Object.entries(
      permissionData.reduce(
        (acc: Record<string, PermissionDataModel[]>, item: PermissionDataModel) => {
          if (!acc[item.subject]) {
            acc[item.subject] = []
          }

          acc[item.subject].push(item)
          return acc
        },
        {},
      ),
    ).map(([subject, items]) => ({ subject, items }))

  return (
    <>
      <div>
        <div className="w-[50%]">
          <Form initialValues={initialValues} form={form} layout="vertical">
            <Form.Item name={'name'} label="Name">
              <Input placeholder="Administrator" />
            </Form.Item>
            <SelectRoleStatus name="type" label="Type" />
          </Form>
        </div>

        {initialValues && groupPermissionData && (
          <>
            <Divider titlePlacement="start">Role Access Control</Divider>
            <Form form={permissionForm}>
              <div className="grid grid-cols-3 gap-10">
                {groupPermissionData.map((permission, index) => {
                  return (
                    <div
                      key={index}
                      className={`mb-6 pr-6  ${(index + 1) % 3 !== 0 && 'border-r'}`}
                    >
                      <h1 className="mb-2 font-bold text-lg">
                        {toCapitalized(permission.subject)}
                      </h1>
                      <div>
                        {permission.items.map((item) => {
                          const isAllow =
                            initialValues.permission
                              .map((role_permission) => role_permission.id)
                              .includes(item.id) || false
                          permissionForm.setFieldValue(item.id, isAllow)

                          return (
                            <div key={item.id} className="flex justify-between">
                              <div>{toCapitalized(`${item.actions} ${item.scope}`)}</div>
                              <Form.Item
                                name={item.id}
                                valuePropName="checked"
                                style={{ marginBottom: 10 }}
                              >
                                <Switch
                                  size="default"
                                  checkedChildren={'ON'}
                                  unCheckedChildren={'OFF'}
                                  checked={true}
                                />
                              </Form.Item>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Form>
          </>
        )}

        <Button onClick={handleSubmit} type="primary" className="self-end">
          Submit
        </Button>
      </div>
    </>
  )
}
