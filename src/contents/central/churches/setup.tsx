'use client'

import CardTitle from '@/components/common/card-title'
import { GoogleMapPicker } from '@/components/common/google-map'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCentralChurch, useCreateCentralChurch, useHierarchy } from '@/hooks/data/central'
import { ChurchCreate, ChurchUpdate } from '@/models/central-church'
import { HierarchyNode } from '@/models/hierarchy'
import { TIMEZONE_OPTIONS } from '@/utils/constant'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  type ThemeConfig,
  Typography,
} from 'antd'
import type { OrgNodeKind } from '@prisma/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import DrawerLifecycle from './drawer-lifecycle'
import PurgeChurchModal from './purge-modal'
import ChurchStatusTag from './status'

const browserTimezone =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC'

const DENOMINATION_OPTIONS = [
  'Lutheran',
  'Lutheran (EELK)',
  'Baptist',
  'Methodist',
  'Catholic',
  'Orthodox',
  'Pentecostal',
  'Anglican',
  'Presbyterian',
].map((value) => ({ value, label: value }))

const WORSHIP_STYLE_OPTIONS = [
  'Traditional',
  'Contemporary',
  'Contemporary Ecumenical',
  'Liturgical',
  'Blended',
  'Charismatic',
].map((value) => ({ value, label: value }))

const normalizeTag = (val: unknown): string | undefined => {
  if (Array.isArray(val)) {
    const last = val[val.length - 1]
    return typeof last === 'string' && last.trim() ? last.trim() : undefined
  }
  if (typeof val === 'string' && val.trim()) {
    return val.trim()
  }
  return undefined
}

const churchFormTheme: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorBorder: '#64748b',
    borderRadius: 8,
    controlHeight: 44,
    fontSize: 14,
    colorText: '#0f172a',
    colorTextPlaceholder: '#8f96a3',
  },
  components: {
    Form: {
      labelHeight: 'auto',
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 16,
      labelFontSize: 14,
      labelColor: '#1e293b',
      labelRequiredMarkColor: '#ef4444',
    },
    Input: {
      controlHeight: 44,
      borderRadius: 8,
      colorBorder: '#64748b',
      hoverBorderColor: '#2563eb',
      activeBorderColor: '#2563eb',
      colorText: '#0f172a',
      colorTextPlaceholder: '#8f96a3',
      paddingInline: 14,
      paddingBlock: 10,
    },
    Select: {
      controlHeight: 44,
      borderRadius: 8,
      colorBorder: '#64748b',
      hoverBorderColor: '#2563eb',
      activeBorderColor: '#2563eb',
      colorText: '#0f172a',
      colorTextPlaceholder: '#8f96a3',
    },
  },
}

const formClasses =
  'flex flex-col flex-1 overflow-hidden ' +
  '[&_.ant-form-item]:!mb-4 ' +
  '[&_.ant-form-item-label]:!pb-1.5 ' +
  '[&_.ant-form-item-label_>_label]:!text-sm ' +
  '[&_.ant-form-item-label_>_label]:!font-semibold ' +
  '[&_.ant-form-item-label_>_label]:!text-neutral-800 ' +
  '[&_.ant-form-item-required::before]:!hidden ' +
  "[&_.ant-form-item-required::after]:!inline-block [&_.ant-form-item-required::after]:!content-['*'] [&_.ant-form-item-required::after]:!text-red-500 [&_.ant-form-item-required::after]:!ml-1 " +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:!text-sm ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:!text-neutral-900 ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:!border-[#64748b] ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:hover:!border-primary-500 ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:focus:!border-primary-500 ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:focus:!shadow-none ' +
  '[&_.ant-input:not(.ant-input-affix-wrapper_.ant-input)]:!rounded-lg ' +
  '[&_.ant-input:not(textarea):not(.ant-input-affix-wrapper_.ant-input)]:!h-11 ' +
  '[&_.ant-input:not(textarea):not(.ant-input-affix-wrapper_.ant-input)]:!px-3.5 ' +
  '[&_.ant-input-affix-wrapper:not(.ant-input-textarea-affix-wrapper)_.ant-input]:!h-full ' +
  '[&_.ant-input-affix-wrapper:not(.ant-input-textarea-affix-wrapper)_.ant-input]:!border-0 ' +
  '[&_.ant-input-affix-wrapper:not(.ant-input-textarea-affix-wrapper)_.ant-input]:!p-0 ' +
  '[&_.ant-input-affix-wrapper:not(.ant-input-textarea-affix-wrapper)_.ant-input]:!shadow-none ' +
  '[&_.ant-input-affix-wrapper:not(.ant-input-textarea-affix-wrapper)_.ant-input]:!bg-transparent ' +
  '[&_.ant-select]:!w-full ' +
  '[&_.ant-select-selector]:!h-11 ' +
  '[&_.ant-select-selector]:!rounded-lg ' +
  '[&_.ant-select-selector]:!border-[#64748b] ' +
  '[&_.ant-select-selector]:hover:!border-primary-500 ' +
  '[&_.ant-select-selector]:!px-3.5 ' +
  '[&_.ant-select-selection-item]:!text-sm ' +
  '[&_.ant-select-selection-item]:!text-neutral-900 ' +
  '[&_.ant-select-selection-item]:!leading-[42px] ' +
  '[&_.ant-select-selection-placeholder]:!text-sm ' +
  '[&_.ant-select-selection-placeholder]:!text-[#8f96a3] ' +
  '[&_.ant-select-selection-placeholder]:!leading-[42px] ' +
  '[&_textarea.ant-input]:!p-3.5 ' +
  '[&_textarea.ant-input]:!text-sm ' +
  '[&_textarea.ant-input]:!text-neutral-900 ' +
  '[&_.ant-input-textarea-affix-wrapper]:!rounded-lg ' +
  '[&_.ant-input-textarea-affix-wrapper]:!border-[#64748b] ' +
  '[&_.ant-input-textarea-affix-wrapper]:hover:!border-primary-500 ' +
  '[&_.ant-input-textarea-affix-wrapper]:focus-within:!border-primary-500 ' +
  '[&_.ant-input-textarea-affix-wrapper]:focus-within:!shadow-none ' +
  '[&_.ant-input-data-count]:!px-3.5 [&_.ant-input-data-count]:!pb-2'

type SetupValues = {
  name: string
  timezone: string
  description?: string
  denomination?: string
  church_style?: string
  latitude?: number | null
  longitude?: number | null
  sunday_live_stream?: boolean
  taize_chants?: boolean
  youth_ministry?: boolean
}

type PlacementValues = { countryId?: string; dioceseId?: string; deaneryId?: string }

const flatten = (nodes: HierarchyNode[], out: HierarchyNode[] = []): HierarchyNode[] => {
  for (const node of nodes) {
    out.push(node)
    flatten(node.children, out)
  }
  return out
}

export interface ChurchSetupFormProps {
  churchId?: string
  onClose?: () => void
  isDrawer?: boolean
}

export function ChurchSetupForm({ churchId, onClose, isDrawer = false }: ChurchSetupFormProps) {
  const router = useRouter()
  const [form] = Form.useForm<SetupValues & PlacementValues>()
  const [purgeOpen, setPurgeOpen] = useState(false)

  const permission = useAccessPermission()
  const canUpdate =
    permission.updateAny('prayer_church').granted || permission.updateOwn('prayer_church').granted

  const { data, loading, saving, error, onUpdate, onLifecycle } = useCentralChurch(churchId ?? '')
  const { onCreate, loading: creating } = useCreateCentralChurch()
  const { data: hierarchy } = useHierarchy(!churchId)
  const [coordsOverride, setCoordsOverride] = useState<{
    id?: string
    coords: { latitude: number; longitude: number } | null
  } | null>(null)

  const pickerCoords =
    coordsOverride && coordsOverride.id === (data?.id ?? '')
      ? coordsOverride.coords
      : data?.latitude != null && data?.longitude != null
        ? { latitude: Number(data.latitude), longitude: Number(data.longitude) }
        : null

  const flat = useMemo(() => flatten(hierarchy ?? []), [hierarchy])
  const countryId = Form.useWatch('countryId', form)
  const dioceseId = Form.useWatch('dioceseId', form)

  useEffect(() => {
    if (!data) return
    form.setFieldsValue({
      name: data.name,
      timezone: data.timezone,
      description: data.description ?? undefined,
      denomination: data.denomination ?? undefined,
      church_style: data.church_style ?? undefined,
      latitude: data.latitude,
      longitude: data.longitude,
    })
  }, [data, form])

  useEffect(() => {
    if (!churchId) form.setFieldValue('timezone', browserTimezone)
  }, [churchId, form])

  const optionsFor = (kind: OrgNodeKind, parentId?: string) =>
    flat
      .filter((node) => node.kind === kind && (!parentId || node.parentId === parentId))
      .map((node) => ({ value: node.id, label: node.name }))

  const submit = async (values: SetupValues & PlacementValues) => {
    const numbers = { latitude: values.latitude, longitude: values.longitude }
    // Both-or-neither: the API rejects a half-filled pair.
    const coords =
      numbers.latitude === null || numbers.latitude === undefined || isNaN(numbers.latitude)
        ? {}
        : numbers
    const shared = {
      name: values.name.trim(),
      timezone: values.timezone || data?.timezone || browserTimezone,
      description: values.description?.trim() || undefined,
      denomination:
        typeof values.denomination === 'string' && values.denomination.trim()
          ? values.denomination.trim()
          : normalizeTag(values.denomination),
      church_style:
        typeof values.church_style === 'string' && values.church_style.trim()
          ? values.church_style.trim()
          : normalizeTag(values.church_style),
      ...(data
        ? {
            sunday_live_stream: data.sunday_live_stream ?? undefined,
            taize_chants: data.taize_chants ?? undefined,
            youth_ministry: data.youth_ministry ?? undefined,
          }
        : {}),
      ...coords,
    }

    if (data) {
      const payload: ChurchUpdate = { version: data.version, ...shared }
      await onUpdate(payload)
      return
    }
    const payload: ChurchCreate = { ...shared, parentId: values.deaneryId }
    const created = await onCreate(payload)
    if (onClose) {
      onClose()
    } else {
      router.replace(`/dashboard/central/churches/${created.id}`)
    }
  }

  if (churchId && loading) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (churchId && error) {
    const errorAlert = (
      <Alert
        type="error"
        showIcon
        message="This church could not be loaded"
        description="It may have been deleted, or the connection failed. Go back to the list and retry."
      />
    )
    return (
      <Card className="[&_.ant-card-body]:!p-6" title={<CardTitle title="Church setup" />}>
        {errorAlert}
      </Card>
    )
  }

  const formFields = (
    <>
      <Form.Item
        name="name"
        label="Church name"
        rules={[{ required: true, message: 'Enter the church name' }]}
      >
        <Input placeholder="Example Church" maxLength={200} />
      </Form.Item>

      {data ? (
        <Form.Item label="Placement">
          <div className="bg-white border border-[#64748b] rounded-lg px-3.5 py-2.5 flex flex-col justify-center min-h-[44px]">
            <span className="text-sm font-normal text-neutral-900 leading-tight">
              {data.organization.length
                ? data.organization.join(' / ')
                : 'Not placed in the hierarchy'}
            </span>
            <span className="text-xs font-normal text-[#8f96a3] mt-1 leading-normal">
              Placement is set when the Church is created. Move it from Central to Hierarchy
            </span>
          </div>
        </Form.Item>
      ) : (
        <Form.Item label="Placement" required>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="countryId"
                label="Country"
                rules={[{ required: true, message: 'Choose the country node' }]}
              >
                <Select
                  showSearch
                  placeholder="Choose country"
                  options={optionsFor('COUNTRY')}
                  onChange={() => {
                    form.setFieldsValue({ dioceseId: undefined, deaneryId: undefined })
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="dioceseId"
                label="Diocese"
                rules={[{ required: true, message: 'Choose the diocese node' }]}
              >
                <Select
                  showSearch
                  placeholder="Choose diocese"
                  disabled={!countryId}
                  options={optionsFor('DIOCESE', countryId)}
                  onChange={() => form.setFieldValue('deaneryId', undefined)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="deaneryId"
                label="Deanery"
                rules={[{ required: true, message: 'Choose the deanery the church belongs to' }]}
              >
                <Select
                  showSearch
                  placeholder="Choose deanery"
                  disabled={!dioceseId}
                  options={optionsFor('DEANERY', dioceseId)}
                  notFoundContent="No deanery under this diocese yet — create it in Central → Hierarchy."
                />
              </Form.Item>
            </Col>
          </Row>
        </Form.Item>
      )}

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="timezone"
            label="Timezone"
            rules={[{ required: true, message: 'Choose the church timezone' }]}
            extra="The church's own clock. Event and service times are shown in this zone."
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Choose timezone"
              options={TIMEZONE_OPTIONS}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="denomination" label="Denomination">
            <AutoComplete
              options={DENOMINATION_OPTIONS}
              filterOption={(inputValue, option) =>
                Boolean(
                  option?.value && option.value.toUpperCase().includes(inputValue.toUpperCase()),
                )
              }
            >
              <Input placeholder="Lutheran (EELK)" maxLength={200} />
            </AutoComplete>
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="church_style" label="Worship style">
            <AutoComplete
              options={WORSHIP_STYLE_OPTIONS}
              filterOption={(inputValue, option) =>
                Boolean(
                  option?.value && option.value.toUpperCase().includes(inputValue.toUpperCase()),
                )
              }
            >
              <Input placeholder="Contemporary Ecumenical" maxLength={200} />
            </AutoComplete>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="description" label="Profile basics">
        <Input.TextArea
          rows={4}
          maxLength={2000}
          showCount
          placeholder="Church description shown in the app"
        />
      </Form.Item>

      <Form.Item label="Church location">
        <div className="flex flex-col gap-2">
          <GoogleMapPicker
            label="Church location"
            latitude={pickerCoords?.latitude}
            longitude={pickerCoords?.longitude}
            onChange={(next) => {
              setCoordsOverride({ id: data?.id ?? '', coords: next })
              form.setFieldsValue({
                latitude: next?.latitude ?? null,
                longitude: next?.longitude ?? null,
              })
            }}
          />
          {pickerCoords && (
            <Typography.Text type="secondary" data-testid="coords-preview">
              {pickerCoords.latitude.toFixed(6)}, {pickerCoords.longitude.toFixed(6)}
            </Typography.Text>
          )}
        </div>
      </Form.Item>
      <Form.Item name="latitude" hidden>
        <InputNumber />
      </Form.Item>
      <Form.Item name="longitude" hidden>
        <InputNumber />
      </Form.Item>
    </>
  )

  const purgeModal = (
    <PurgeChurchModal
      church={
        purgeOpen && data ? { id: data.id, name: data.name, version: data.version } : undefined
      }
      onClose={() => setPurgeOpen(false)}
    />
  )

  if (isDrawer) {
    return (
      <ConfigProvider theme={churchFormTheme}>
        <div className="flex flex-col h-full bg-white">
          <div className="flex flex-col gap-3 px-6 pt-5 pb-4 border-b border-neutral-200 bg-white shrink-0">
            <div className="grid grid-cols-[1fr_auto] sm:flex sm:justify-between sm:items-start gap-3">
              <div className="col-start-1 flex flex-col gap-1.5 min-w-0 items-start">
                {data && <ChurchStatusTag status={data.status} />}
                <h2 className="text-base font-semibold text-primary-900 m-0 truncate w-full">
                  {data?.name ?? 'Church setup'}
                </h2>
              </div>
              {onClose && (
                <button
                  type="button"
                  className="col-start-2 sm:order-3 w-8 h-8 rounded-lg inline-flex items-center justify-center text-primary-500 border border-primary-500 hover:text-primary-700 hover:border-primary-700 bg-transparent cursor-pointer p-0 shrink-0"
                  onClick={onClose}
                  aria-label="Close drawer"
                >
                  <CloseOutlined />
                </button>
              )}
              {data && (
                <div className="col-span-2 sm:order-2 flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto">
                  <Link
                    href={`/dashboard/churches/${data.id}/profile`}
                    className="flex-1 sm:flex-initial"
                  >
                    <Button className="w-full sm:w-auto h-8 rounded-lg text-xs font-semibold text-primary-500 border-primary-500 hover:!text-primary-700 hover:!border-primary-700">
                      Full Profile
                    </Button>
                  </Link>
                  <Link href="/dashboard/central/pastors" className="flex-1 sm:flex-initial">
                    <Button className="w-full sm:w-auto h-8 rounded-lg text-xs font-semibold text-primary-500 border-primary-500 hover:!text-primary-700 hover:!border-primary-700">
                      Manage Pastors
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <Form<SetupValues & PlacementValues>
            form={form}
            layout="vertical"
            onFinish={submit}
            disabled={Boolean(data) && !canUpdate}
            className={formClasses}
          >
            <div className="flex-1 overflow-y-auto p-6">{formFields}</div>

            {data ? (
              <DrawerLifecycle
                church={data}
                onLifecycle={onLifecycle}
                showSave
                submitting={saving || creating}
              />
            ) : (
              <div className="px-6 py-4 border-t border-neutral-200 flex justify-end bg-white shrink-0">
                <Button
                  aria-label="Save setup"
                  type="primary"
                  htmlType="submit"
                  loading={creating}
                  className="h-10 rounded-lg px-4 text-sm font-semibold inline-flex items-center gap-1.5"
                  icon={<CheckOutlined />}
                >
                  Save setup
                </Button>
              </div>
            )}
          </Form>
          {purgeModal}
        </div>
      </ConfigProvider>
    )
  }

  return (
    <Card
      className="[&_.ant-card-body]:!p-6"
      styles={{ body: { padding: '24px' } }}
      title={<CardTitle title="Church setup" />}
      extra={
        data && (
          <Space wrap>
            <Link href={`/dashboard/churches/${data.id}/profile`}>
              <Button>Open full church profile</Button>
            </Link>
            <Link href="/dashboard/central/pastors">
              <Button>Manage assigned pastors</Button>
            </Link>
          </Space>
        )
      }
    >
      <Space className="mb-4" wrap>
        {data ? (
          <div className="flex items-center gap-2 items-start">
            <Typography.Text strong>{data.name}</Typography.Text>
            <ChurchStatusTag status={data.status} />
          </div>
        ) : (
          <Typography.Text type="secondary">
            New church — created as Pending, invisible in the app until it is approved.
          </Typography.Text>
        )}
      </Space>

      <ConfigProvider theme={churchFormTheme}>
        <Form<SetupValues & PlacementValues>
          form={form}
          layout="vertical"
          onFinish={submit}
          disabled={Boolean(data) && !canUpdate}
          className={formClasses}
        >
          {formFields}

          {data ? (
            <DrawerLifecycle
              church={data}
              onLifecycle={onLifecycle}
              showSave
              submitting={saving || creating}
            />
          ) : (
            <Space wrap className="mt-4">
              <Button
                aria-label="Save setup"
                type="primary"
                htmlType="submit"
                loading={saving || creating}
                className="h-10 rounded-lg px-4 text-sm font-semibold inline-flex items-center gap-1.5"
                icon={<CheckOutlined />}
              >
                Save setup
              </Button>
            </Space>
          )}
        </Form>
      </ConfigProvider>
      {purgeModal}
    </Card>
  )
}

/**
 * S16 — church setup and lifecycle. Default export for route pages.
 */
export default function ContentsCentralChurchSetup({ churchId }: { churchId?: string }) {
  return <ChurchSetupForm churchId={churchId} />
}
