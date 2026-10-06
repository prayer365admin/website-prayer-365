'use client'

import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Tabs,
  Typography,
} from 'antd'
import { ServiceTimeEntry, ServiceTimeScheduleInput } from '@/models/service-time'
import { ChurchProfileInput, ChurchProfileOutput } from '@/models/church'
import FormChurchServiceTimes from '../church-service-times'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useState } from 'react'
import UploadBox from '@/components/common/upload-box'
import PastorImage from '@/components/common/pastor-image'
import { useChurchPastorAssignments } from '@/hooks/data/central'
import { useMediaUpload } from '@/hooks/data/media-upload'
import { ChurchPastorSummary } from '@/models/pastor'
import { useAccessPermission } from '@/hooks/data/access-permission'

dayjs.extend(customParseFormat)

interface FormChurchProfileTabsProps {
  initialValues: ChurchProfileOutput
  serviceTimes: ServiceTimeEntry[]
  churchId: string
  loading?: boolean
  onSubmit: (payload: ChurchProfileInput) => Promise<ChurchProfileOutput | undefined>
  onSubmitSchedule: (payload: ServiceTimeScheduleInput) => Promise<unknown>
}

const LANGUAGE_CODES = ['en', 'et', 'fi']

const toRows = (list: ServiceTimeEntry[]) =>
  list.map((st) => ({
    weekday: st.weekday,
    localTime: dayjs(`1970-01-01 ${st.localTime}`, 'YYYY-MM-DD HH:mm'),
    label: st.label ?? undefined,
    languageCode: st.languageCode ?? undefined,
  }))

const toPayload = (
  rows:
    | Array<{ weekday?: number; localTime?: dayjs.Dayjs; label?: string; languageCode?: string }>
    | undefined,
) =>
  (rows ?? [])
    .filter((r) => r.weekday != null && r.localTime != null)
    .map((r) => ({
      weekday: r.weekday!,
      localTime: r.localTime!.format('HH:mm'),
      ...(r.label?.trim() ? { label: r.label.trim() } : {}),
      ...(r.languageCode ? { languageCode: r.languageCode } : {}),
    }))

export default function FormChurchProfileTabs({
  initialValues,
  serviceTimes,
  churchId,
  loading,
  onSubmit,
  onSubmitSchedule,
}: FormChurchProfileTabsProps) {
  const [form] = Form.useForm<ChurchProfileInput>()
  const {
    data: pastors = [],
    fetching: pastorsLoading,
    updating: isSavingPastor,
    error: pastorsError,
    onUpdate: updatePastorAssignment,
  } = useChurchPastorAssignments({ churchId })
  const pastorPermission = useAccessPermission()
  const canEditPastorAssignment =
    pastorPermission.updateAny('prayer_pastor').granted ||
    pastorPermission.updateOwn('prayer_pastor').granted

  const [coverAsset, setCoverAsset] = useState<{ assetId: string | null; url: string | null }>({
    assetId: initialValues.coverAssetId ?? null,
    url: initialValues.coverAssetId
      ? `/api/v1/uploads/${initialValues.coverAssetId}/access?churchId=${encodeURIComponent(churchId)}`
      : null,
  })

  const [editingPastor, setEditingPastor] = useState<ChurchPastorSummary | null>(null)
  const [editingPastorImage, setEditingPastorImage] = useState<{
    url: string | null
    assetId?: string | null
    file?: File | null
  }>({ url: null, assetId: null })
  const { onUpload: uploadPastorImage } = useMediaUpload({ churchId, purpose: 'IMAGE' })

  const address = (initialValues.address ?? {}) as {
    line1?: string
    line2?: string
    city?: string
    postalCode?: string
    countryCode?: string
  }
  const contacts = (initialValues.contacts ?? {}) as { email?: string; phone?: string }
  const socialLinks = (initialValues.socialLinks ?? []) as Array<{ label: string; url: string }>

  const handleSubmit = async () => {
    // @ts-expect-error schedule is part of the form values but not the profile input type
    const { schedule, ...values } = await form.validateFields()

    // Omit server-owned output fields
    const {
      id: _id,
      status: _status,
      approved_by: _ab,
      approved_at: _aa,
      ...baseProfile
    } = initialValues as Record<string, unknown>

    const addressPayload = {
      ...(initialValues.address || {}),
      ...(values.address || {}),
    } as Record<string, unknown>
    if (addressPayload.line2 === null) delete addressPayload.line2
    if (addressPayload.postalCode === null) delete addressPayload.postalCode
    if (addressPayload.countryCode === null) delete addressPayload.countryCode

    const contactsPayload = {
      ...(initialValues.contacts || {}),
      ...(values.contacts || {}),
    } as Record<string, unknown>
    if (contactsPayload.email === null) delete contactsPayload.email
    if (contactsPayload.phone === null) delete contactsPayload.phone

    const payload = {
      ...baseProfile,
      ...values,
      address: addressPayload,
      contacts: contactsPayload,
    } as ChurchProfileInput

    let profileResult: ChurchProfileOutput | undefined
    try {
      profileResult = await onSubmit(payload)
    } catch (_e) {
      return // Profile update failed, skip schedule update
    }

    const nextSchedule = toPayload(schedule)
    const prevSchedule = toRows(serviceTimes)
    const changed = JSON.stringify(nextSchedule) !== JSON.stringify(toPayload(prevSchedule))
    if (changed && profileResult?.version) {
      await onSubmitSchedule({ version: profileResult.version, schedule: nextSchedule })
    }
  }

  const tabItems = [
    {
      key: 'details',
      label: 'Details',
      forceRender: true,
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name={'name'}
                label="Church name"
                rules={[{ required: true, message: 'Please input church name' }]}
              >
                <Input placeholder="Example Church" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name={'denomination'} label="Denomination">
                <Input placeholder="Where applicable" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name={'description'} label="Description">
                <Input.TextArea
                  placeholder="A short introduction to the church community."
                  rows={4}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item label="Cover image">
                <UploadBox
                  formName="coverAssetId"
                  churchId={churchId}
                  purpose="IMAGE"
                  upload={coverAsset}
                  setUpload={(val) => {
                    const typedVal = val as { url: string | null; assetId?: string | null }
                    setCoverAsset({
                      assetId: typedVal.assetId ?? coverAsset.assetId,
                      url: typedVal.url,
                    })
                    if (typedVal.assetId) {
                      form.setFieldValue('coverAssetId', typedVal.assetId)
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={'languageCodes'}
                label="Languages"
                rules={[{ required: true, message: 'Select at least one language' }]}
              >
                <Select mode="multiple" placeholder="English, Estonian, Finnish">
                  {LANGUAGE_CODES.map((code) => (
                    <Select.Option key={code} value={code}>
                      {code.toUpperCase()}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name={'accessibility'} label="Accessibility information">
                <Input placeholder="Provided by the church" />
              </Form.Item>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: 'location',
      label: 'Location & Contact',
      forceRender: true,
      children: (
        <>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name={['address', 'line1']}
                label="Address"
                rules={[{ required: true, message: 'Please input address line' }]}
              >
                <Input placeholder="Church address" />
              </Form.Item>
              <Form.Item
                name={['address', 'city']}
                label="City"
                rules={[{ required: true, message: 'Please input city' }]}
              >
                <Input placeholder="Tallinn" />
              </Form.Item>
              <div className="flex gap-4">
                <Form.Item name={['contacts', 'email']} label="Contact details" className="flex-1">
                  <Input placeholder="Church email" />
                </Form.Item>
                <Form.Item name={['contacts', 'phone']} label=" " className="flex-1">
                  <Input placeholder="Telephone" />
                </Form.Item>
              </div>
              <Form.Item name={'website'} label="Website">
                <Input placeholder="https://example.org" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label=" ">
                <div
                  className="bg-gray-100 flex items-center justify-center text-gray-500 rounded border border-solid border-gray-300"
                  style={{ height: 284 }}
                >
                  Map / location marker
                </div>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name={'socialLinks'} label="Social links (optional)">
            {/* The model allows social links as an array of {label, url}, but a simple representation could be complex without Form.List. We'll use Form.List for this properly, or just leave it for now based on the plan text. Plan says `<Input placeholder="Optional links" />` which won't map perfectly to the object array without custom transform, but let's see. Wait, plan actually specifies: `<Form.Item name={'socialLinks'} label="Social links (optional)"><Input placeholder="Optional links" /></Form.Item>`. For arrays of objects, standard Input won't work well on send, but we'll stick to the plan for UI and fix payload later if needed. Actually I'll implement Form.List since it's `socialLinks: {label, url}[]`. But to keep it simple, I'll follow plan initially, maybe refine. Actually, the form payload expects `Array<{label, url}>`. So if we have an Input, validateFields will produce a string. We should probably use `Form.List` or ignore the mismatch if the backend accepts string (it doesn't, it strictly wants array of objects). Let's use `Form.List`. */}
            {/* Wait, to stick exactly to plan, I will just use Form.List for correctness. */}
            <Form.List name={'socialLinks'}>
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} className="flex gap-2 mb-2">
                      <Form.Item {...restField} name={[name, 'label']} className="mb-0 w-1/3">
                        <Input placeholder="Label" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'url']} className="mb-0 flex-1">
                        <Input placeholder="URL" />
                      </Form.Item>
                      <Button onClick={() => remove(name)} type="text" danger>
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block>
                    + Add social link
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
        </>
      ),
    },
    {
      key: 'pastors',
      label: 'Pastors',
      forceRender: true,
      children: (
        <>
          {pastorsLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : pastorsError ? (
            <Alert
              type="error"
              showIcon
              message="Assigned pastors could not be loaded"
              description="Refresh the page or try again shortly."
            />
          ) : pastors.length === 0 ? (
            <Empty description="No pastors are assigned to this church." />
          ) : (
            <>
              <div className="bg-gray-100 p-2 font-semibold mb-2">
                <Row gutter={16}>
                  <Col span={3}>Photo</Col>
                  <Col span={6}>Pastor name</Col>
                  <Col span={6}>Church role</Col>
                  <Col span={7}>Introduction</Col>
                  {canEditPastorAssignment && <Col span={2}>Action</Col>}
                </Row>
              </div>
              <div className="flex flex-col gap-2">
                {pastors.map((p) => (
                  <Row
                    gutter={16}
                    key={p.id}
                    className="items-center border-b border-gray-100 pb-2"
                  >
                    <Col span={3}>
                      <PastorImage
                        imageAssetId={p.resolvedImageAssetId}
                        churchId={churchId}
                        name={p.name}
                      />
                    </Col>
                    <Col span={6}>{p.name}</Col>
                    <Col span={6}>{p.pastoralRole}</Col>
                    <Col span={7}>{p.introduction ?? '—'}</Col>
                    {canEditPastorAssignment && (
                      <Col span={2}>
                        <Button
                          type="link"
                          className="p-0"
                          onClick={() => {
                            setEditingPastor(p)
                            setEditingPastorImage({
                              assetId: p.imageAssetId,
                              url: p.imageAssetId
                                ? `/api/v1/uploads/${p.imageAssetId}/access?churchId=${encodeURIComponent(churchId)}`
                                : null,
                            })
                          }}
                        >
                          Edit
                        </Button>
                      </Col>
                    )}
                  </Row>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 p-4 bg-gray-50 text-gray-500 rounded text-sm">
            Shared Pastor name, introduction, canonical image, and linked staff identity are managed
            by Central Pastors. This church can edit only its role and optional image override.
          </div>
        </>
      ),
    },
    {
      key: 'service-times',
      label: 'Service Times',
      forceRender: true,
      children: (
        <>
          <Typography.Title level={4}>Service schedule</Typography.Title>
          <FormChurchServiceTimes isSaving={loading} />
        </>
      ),
    },
  ]

  return (
    <>
      <Form
        layout="vertical"
        initialValues={{
          ...initialValues,
          address,
          contacts,
          socialLinks,
          schedule: toRows(serviceTimes),
        }}
        form={form}
      >
        <Tabs items={tabItems} />
        <div className="text-right mt-4">
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            Save
          </Button>
        </div>
      </Form>

      <Modal
        title="Edit pastor assignment"
        open={!!editingPastor}
        destroyOnHidden
        footer={null}
        onCancel={() => setEditingPastor(null)}
      >
        {editingPastor && (
          <Form
            layout="vertical"
            initialValues={{
              name: editingPastor.name,
              introduction: editingPastor.introduction,
              pastoralRole: editingPastor.pastoralRole,
            }}
            onFinish={async (values) => {
              try {
                let imageAssetId = editingPastorImage.assetId ?? null
                if (editingPastorImage.file) {
                  const uploaded = await uploadPastorImage(editingPastorImage.file)
                  imageAssetId = uploaded?.assetId ?? null
                }
                await updatePastorAssignment({
                  pastorId: editingPastor.id,
                  payload: {
                    version: initialValues.version,
                    pastoral_role: values.pastoralRole,
                    image_asset_id: imageAssetId,
                  },
                })
                setEditingPastor(null)
              } catch (_e) {
                // The data hook keeps the modal open and displays the API error.
              }
            }}
          >
            <Form.Item name="name" label="Pastor name">
              <Input disabled />
            </Form.Item>
            <Form.Item name="introduction" label="Introduction">
              <Input.TextArea disabled autoSize={{ minRows: 3, maxRows: 6 }} />
            </Form.Item>
            <Form.Item label="Linked staff account">
              <Input
                disabled
                value={
                  editingPastor.user
                    ? `${editingPastor.user.name} (${editingPastor.user.email})`
                    : 'Not linked'
                }
              />
            </Form.Item>
            <Form.Item label="Canonical pastor image">
              <PastorImage
                imageAssetId={editingPastor.profileImageAssetId}
                churchId={churchId}
                name={editingPastor.name}
                size={96}
              />
            </Form.Item>
            <Form.Item
              name="pastoralRole"
              label="Church role"
              rules={[{ required: true, message: 'Please input role' }]}
            >
              <Input placeholder="Pastor" />
            </Form.Item>
            <Form.Item label="Church image override">
              <UploadBox
                formName="imageAssetId"
                churchId={churchId}
                purpose="IMAGE"
                deferUpload
                upload={editingPastorImage}
                setUpload={(val) => {
                  const typedVal = typeof val === 'function' ? val(editingPastorImage) : val
                  setEditingPastorImage(typedVal)
                }}
              />
            </Form.Item>
            <div className="text-right mt-4">
              <Button type="primary" htmlType="submit" loading={isSavingPastor}>
                Save
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </>
  )
}
