import { useCentralChurches, usePastorStaffOptions } from '@/hooks/data/central'
import { PastorFormModel } from '@/models/pastor'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Divider, Empty, Form, Input, Select, Skeleton, Space } from 'antd'
import UploadBox from '@/components/common/upload-box'
import { useMediaUpload } from '@/hooks/data/media-upload'
import { useState } from 'react'

type PastorAssignmentForm = {
  churchId: string
}

type PastorFormValues = PastorFormModel & {
  assignments?: PastorAssignmentForm[]
}

export default function FormPastor({
  initialValues,
  onSubmit,
  loading,
  type = 'CREATE',
  initialLinkedStaff,
}: {
  initialValues?: PastorFormModel
  onSubmit: (payload: PastorFormModel) => Promise<void>
  loading: boolean
  type?: 'CREATE' | 'UPDATE'
  initialLinkedStaff?: { id: string; name: string; email: string }
}) {
  const [form] = Form.useForm<PastorFormValues>()
  const assignments = Form.useWatch('assignments', form) ?? []
  const uploadChurchId = assignments[0]?.churchId ?? initialValues?.imageChurchId ?? ''
  const [profileImage, setProfileImage] = useState<{
    url: string | null
    assetId?: string | null
    file?: File | null
  }>({
    assetId: initialValues?.imageAssetId ?? null,
    url:
      initialValues?.imageAssetId && initialValues.imageChurchId
        ? `/api/v1/uploads/${initialValues.imageAssetId}/access?churchId=${encodeURIComponent(initialValues.imageChurchId)}`
        : null,
  })
  const [imageChurchId, setImageChurchId] = useState<string | null>(
    initialValues?.imageChurchId ?? null,
  )
  const { data: churches, isLoading: churchesLoading, error: churchesError } = useCentralChurches()
  const staffQuery = usePastorStaffOptions()
  const { onUpload } = useMediaUpload({ churchId: uploadChurchId, purpose: 'IMAGE' })

  const handleSubmit = async (values: PastorFormValues) => {
    const seenChurches = new Set<string>()
    const duplicateIndex = values.assignments?.findIndex((assignment) => {
      if (!assignment?.churchId) return false
      if (seenChurches.has(assignment.churchId)) return true
      seenChurches.add(assignment.churchId)
      return false
    })
    if (duplicateIndex !== undefined && duplicateIndex >= 0) {
      form.setFields([
        {
          name: ['assignments', duplicateIndex, 'churchId'],
          errors: ['This church is already assigned to the pastor.'],
        },
      ])
      return
    }
    try {
      let imageAssetId = profileImage.assetId ?? null
      let selectedImageChurchId = imageChurchId
      if (profileImage.file) {
        const uploaded = await onUpload(profileImage.file)
        imageAssetId = uploaded?.assetId ?? null
        selectedImageChurchId = uploadChurchId
      }
      await onSubmit({
        name: values.name.trim(),
        introduction: values.introduction?.trim() || null,
        imageAssetId,
        imageChurchId: selectedImageChurchId,
        userId: values.userId ?? null,
        assignments: (values.assignments ?? []).map(({ churchId }) => ({ churchId })),
      })
    } catch (_error) {
      // Mutation hooks display the actionable API error; preserve the form for correction/retry.
    }
  }

  if (loading && type === 'UPDATE' && !initialValues) {
    return (
      <div className="w-full lg:w-1/2">
        <Skeleton active />
      </div>
    )
  }

  if (type === 'UPDATE' && !initialValues) {
    return <Empty description="Pastor profile not found." />
  }

  const churchOptions = (churches ?? []).map((church) => ({
    label:
      church.name + (church.status === 'APPROVED' ? '' : ' (' + church.status.toLowerCase() + ')'),
    value: church.id,
  }))
  const staffOptions = [...(staffQuery.data ?? [])]
  if (initialLinkedStaff && !staffOptions.some(({ id }) => id === initialLinkedStaff.id)) {
    staffOptions.push(initialLinkedStaff)
  }
  const linkedStaffOptions = staffOptions.map((user) => ({
    label: user.name + ' (' + user.email + ')',
    value: user.id,
  }))

  return (
    <div className="w-full lg:w-1/2">
      {(churchesError || staffQuery.error) && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Some assignment options could not be loaded"
          description="You can still edit the profile fields. Reload before changing church or staff assignments."
        />
      )}
      <Form<PastorFormValues>
        layout="vertical"
        initialValues={initialValues}
        form={form}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="name"
          label="Pastor Name"
          rules={[
            { required: true, whitespace: true, message: 'Enter the pastor’s name.' },
            { max: 200, message: 'Use 200 characters or fewer.' },
          ]}
        >
          <Input placeholder="Ex. Pastor John Doe" maxLength={200} />
        </Form.Item>

        <Form.Item name="introduction" label="Introduction">
          <Input.TextArea
            placeholder="Short biography shown in church experiences"
            autoSize={{ minRows: 5, maxRows: 10 }}
            maxLength={2000}
            showCount
          />
        </Form.Item>

        <Form.Item label="Canonical pastor image">
          <UploadBox
            formName="imageAssetId"
            churchId={uploadChurchId}
            purpose="IMAGE"
            deferUpload
            disabled={!uploadChurchId}
            upload={profileImage}
            setUpload={(nextValue) => {
              const resolved = typeof nextValue === 'function' ? nextValue(profileImage) : nextValue
              setProfileImage(resolved)
              if (resolved.assetId) setImageChurchId(uploadChurchId)
              if (resolved.assetId === null) setImageChurchId(null)
            }}
          />
          {!uploadChurchId && (
            <div className="mt-2 text-sm text-gray-500">
              Select a church assignment before uploading the canonical image.
            </div>
          )}
        </Form.Item>

        <Form.Item name="userId" label="Linked Staff Account">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Select a staff account"
            options={linkedStaffOptions}
            loading={staffQuery.isLoading}
          />
        </Form.Item>

        <Divider>Churches</Divider>
        <Form.List name="assignments">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, ...field }) => (
                <div key={key} className="mb-6 rounded-lg border border-gray-200 p-4">
                  <Space orientation="vertical" className="w-full" size="middle">
                    <Form.Item
                      {...field}
                      name={[field.name, 'churchId']}
                      label="Church"
                      rules={[{ required: true, message: 'Select a church.' }]}
                    >
                      <Select
                        showSearch
                        optionFilterProp="label"
                        options={churchOptions.filter(
                          (option) =>
                            !assignments.some(
                              (assignment, assignmentIndex) =>
                                assignmentIndex !== field.name &&
                                assignment?.churchId === option.value,
                            ),
                        )}
                        loading={churchesLoading}
                        placeholder="Select a church"
                      />
                    </Form.Item>
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => remove(field.name)}
                    >
                      Remove church assignment
                    </Button>
                  </Space>
                </div>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add()}>
                Add church
              </Button>
            </>
          )}
        </Form.List>

        <Button type="primary" htmlType="submit" loading={loading} className="mt-4">
          Save
        </Button>
      </Form>
    </div>
  )
}
