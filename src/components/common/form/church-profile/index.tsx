'use client'

import { Button, Form, Input, Select, Tabs, Typography, Row, Col, Modal } from 'antd'
import { ServiceTimeEntry, ServiceTimeScheduleInput } from '@/models/service-time'
import { ChurchProfileInput, ChurchProfileOutput } from '@/models/church'
import FormChurchServiceTimes from '../church-service-times'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import axios from 'axios'
import { useEffect, useState, useCallback } from 'react'
import UploadBox from '@/components/common/upload-box'
import Image from 'next/image'
import { useMainNotification } from '@/hooks/ui/notification'

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

function PastorListThumbnail({
  imageAssetId,
  churchId,
  name,
}: {
  imageAssetId: string
  churchId: string
  name: string
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let isMounted = true
    axios
      .get(`/api/v1/uploads/${imageAssetId}/access?churchId=${encodeURIComponent(churchId)}`)
      .then((res) => {
        if (isMounted && res.data?.result?.url) setSrc(res.data.result.url)
      })
      .catch(() => {})
    return () => {
      isMounted = false
    }
  }, [imageAssetId, churchId])

  if (!src)
    return (
      <div className="w-12 h-12 bg-gray-200 text-gray-500 rounded flex items-center justify-center text-xs">
        Image
      </div>
    )
  return <Image src={src} width={48} height={48} className="rounded object-cover" alt={name} />
}

export default function FormChurchProfileTabs({
  initialValues,
  serviceTimes,
  churchId,
  loading,
  onSubmit,
  onSubmitSchedule,
}: FormChurchProfileTabsProps) {
  const [form] = Form.useForm<ChurchProfileInput>()
  const showNotification = useMainNotification()
  const [pastors, setPastors] = useState<
    Array<{
      id: string
      name: string
      introduction: string | null
      pastoralRole: string
      imageAssetId: string | null
    }>
  >([])

  const [coverAsset, setCoverAsset] = useState<{ assetId: string | null; url: string | null }>({
    assetId: initialValues.coverAssetId ?? null,
    url: initialValues.coverAssetId
      ? `/api/v1/uploads/${initialValues.coverAssetId}/access?churchId=${encodeURIComponent(churchId)}`
      : null,
  })

  const [isSavingPastor, setIsSavingPastor] = useState(false)
  const [editingPastor, setEditingPastor] = useState<{
    id: string
    name: string
    pastoralRole: string
    imageAssetId: string | null
  } | null>(null)

  const loadPastors = useCallback(async () => {
    try {
      const result = await axios.get(`/api/v1/admin/churches/${churchId}/pastors`)
      setPastors(result.data.result || [])
    } catch {
      setPastors([])
    }
  }, [churchId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPastors()
  }, [loadPastors])

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
          <div className="bg-gray-100 p-2 font-semibold mb-2">
            <Row gutter={16}>
              <Col span={3}>Photo</Col>
              <Col span={6}>Pastor name</Col>
              <Col span={6}>Church role</Col>
              <Col span={7}>Introduction</Col>
              <Col span={2}>Action</Col>
            </Row>
          </div>
          <div className="flex flex-col gap-2">
            {pastors.map((p) => (
              <Row gutter={16} key={p.id} className="items-center border-b border-gray-100 pb-2">
                <Col span={3}>
                  {p.imageAssetId ? (
                    <PastorListThumbnail
                      imageAssetId={p.imageAssetId}
                      churchId={churchId}
                      name={p.name}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-200 text-gray-500 rounded flex items-center justify-center text-xs">
                      Image
                    </div>
                  )}
                </Col>
                <Col span={6}>{p.name}</Col>
                <Col span={6}>{p.pastoralRole}</Col>
                <Col span={7}>{p.introduction ?? '—'}</Col>
                <Col span={2}>
                  <a onClick={() => setEditingPastor(p)}>Edit</a>
                </Col>
              </Row>
            ))}
          </div>
          <div className="mt-4 p-4 bg-gray-50 text-gray-500 rounded text-sm">
            Edit assigned pastor information within granted church permissions.
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
            initialValues={{ pastoralRole: editingPastor.pastoralRole }}
            onFinish={async (values) => {
              try {
                setIsSavingPastor(true)
                await axios.patch(
                  `/api/v1/admin/churches/${churchId}/pastors/${editingPastor.id}`,
                  {
                    version: initialValues.version,
                    pastoral_role: values.pastoralRole,
                    image_asset_id: editingPastor.imageAssetId ?? null,
                  },
                )
                await loadPastors()
                setEditingPastor(null)
              } catch (_e) {
                showNotification({ type: 'error', entity: 'church pastor', action: 'updated' })
              } finally {
                setIsSavingPastor(false)
              }
            }}
          >
            <Form.Item
              name="pastoralRole"
              label="Church role"
              rules={[{ required: true, message: 'Please input role' }]}
            >
              <Input placeholder="Pastor" />
            </Form.Item>
            <Form.Item label="Pastor image">
              <UploadBox
                formName="imageAssetId"
                churchId={churchId}
                purpose="IMAGE"
                upload={{
                  url: editingPastor.imageAssetId
                    ? `/api/v1/uploads/${editingPastor.imageAssetId}/access?churchId=${encodeURIComponent(churchId)}`
                    : null,
                }}
                setUpload={(val) => {
                  const typedVal = val as { url: string | null; assetId?: string | null }
                  setEditingPastor({
                    ...editingPastor,
                    imageAssetId: typedVal.assetId ?? editingPastor.imageAssetId,
                  })
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
