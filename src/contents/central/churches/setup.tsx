'use client'

import CardTitle from '@/components/common/card-title'
import { useAccessPermission } from '@/hooks/data/access-permission'
import {
  ChurchLifecycleAction,
  useCentralChurch,
  useCreateCentralChurch,
  useHierarchy,
} from '@/hooks/data/central'
import { ChurchCreate, ChurchUpdate } from '@/models/central-church'
import { HierarchyNode } from '@/models/hierarchy'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Typography,
} from 'antd'
import type { OrgNodeKind } from '@prisma/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PurgeChurchModal from './purge-modal'
import ChurchStatusTag from './status'

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

/** `Intl.supportedValuesOf` is not in every runtime; the browser zone is always offered. */
const TIMEZONE_OPTIONS = Array.from(
  new Set([
    browserTimezone,
    ...(() => {
      const supported = (Intl as { supportedValuesOf?: (key: string) => string[] })
        .supportedValuesOf
      try {
        return supported?.('timeZone') ?? []
      } catch {
        return []
      }
    })(),
  ]),
).map((value) => ({ value, label: value }))

/* D2 (suspension/archive effects) is still open in SPEC; these sentences are the
 * agreed visibility wording and must be re-checked when D2 is decided. */
const LIFECYCLE: Record<
  ChurchLifecycleAction,
  { label: string; effect: string; danger?: boolean }
> = {
  approve: {
    label: 'Approve',
    effect: 'The church becomes visible in the public app and can publish content.',
  },
  suspend: {
    label: 'Suspend',
    effect: 'The church keeps its data but stops being publicly available.',
  },
  archive: {
    label: 'Archive',
    effect: 'The church is archived, not deleted: it stays in this list and leaves the app.',
    danger: true,
  },
}

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

/**
 * S16 — church setup and lifecycle. One component for both modes: create (no id)
 * collects hierarchy placement, edit binds the stored record. Placement is fixed
 * after creation — moving a node is the Hierarchy screen's job.
 */
export default function ContentsCentralChurchSetup({ churchId }: { churchId?: string }) {
  const router = useRouter()
  const { modal } = App.useApp()
  const [form] = Form.useForm<SetupValues & PlacementValues>()
  const [purgeOpen, setPurgeOpen] = useState(false)

  const permission = useAccessPermission()
  const canUpdate =
    permission.updateAny('prayer_church').granted || permission.updateOwn('prayer_church').granted
  const canLifecycle =
    permission.updateAny('prayer_church_lifecycle').granted ||
    permission.updateOwn('prayer_church_lifecycle').granted
  const canDelete =
    permission.deleteAny('prayer_church').granted || permission.deleteOwn('prayer_church').granted

  const { data, loading, saving, error, onUpdate, onLifecycle } = useCentralChurch(churchId ?? '')
  const { onCreate, loading: creating } = useCreateCentralChurch()
  const { data: hierarchy } = useHierarchy(!churchId)

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
      sunday_live_stream: data.sunday_live_stream ?? false,
      taize_chants: data.taize_chants ?? false,
      youth_ministry: data.youth_ministry ?? false,
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
    const coords = numbers.latitude === null || numbers.latitude === undefined ? {} : numbers
    const shared = {
      name: values.name.trim(),
      timezone: values.timezone,
      description: values.description?.trim() || undefined,
      denomination: values.denomination?.trim() || undefined,
      church_style: values.church_style?.trim() || undefined,
      sunday_live_stream: Boolean(values.sunday_live_stream),
      taize_chants: Boolean(values.taize_chants),
      youth_ministry: Boolean(values.youth_ministry),
      ...coords,
    }

    if (data) {
      const payload: ChurchUpdate = { version: data.version, ...shared }
      await onUpdate(payload)
      return
    }
    const payload: ChurchCreate = { ...shared, parentId: values.deaneryId }
    const created = await onCreate(payload)
    router.replace(`/dashboard/central/churches/${created.id}`)
  }

  const runLifecycle = (action: ChurchLifecycleAction) => {
    if (!data) return
    const { label, effect, danger } = LIFECYCLE[action]
    modal.confirm({
      title: `${label} ${data.name}?`,
      content: <p>{effect}</p>,
      okText: label,
      okButtonProps: danger ? { danger: true } : undefined,
      onOk: () => onLifecycle({ action, version: data.version }),
    })
  }

  if (churchId && loading) return <Skeleton active paragraph={{ rows: 8 }} />

  if (churchId && error) {
    return (
      <Card title={<CardTitle title="Church setup" />}>
        <Alert
          type="error"
          showIcon
          message="This church could not be loaded"
          description="It may have been deleted, or the connection failed. Go back to the list and retry."
        />
      </Card>
    )
  }

  return (
    <Card
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
          <>
            <Typography.Text strong>{data.name}</Typography.Text>
            <ChurchStatusTag status={data.status} />
          </>
        ) : (
          <Typography.Text type="secondary">
            New church — created as Pending, invisible in the app until it is approved.
          </Typography.Text>
        )}
      </Space>

      <Form<SetupValues & PlacementValues>
        form={form}
        layout="vertical"
        onFinish={submit}
        disabled={Boolean(data) && !canUpdate}
        initialValues={{ sunday_live_stream: false, taize_chants: false, youth_ministry: false }}
      >
        <Form.Item
          name="name"
          label="Church name"
          rules={[{ required: true, message: 'Enter the church name' }]}
        >
          <Input placeholder="Example Church" maxLength={200} />
        </Form.Item>

        {data ? (
          <Form.Item label="Placement">
            <Typography.Text>
              {data.organization.length
                ? data.organization.join(' / ')
                : 'Not placed in the hierarchy'}
            </Typography.Text>
            <Typography.Paragraph type="secondary" className="!mb-0">
              Placement is set when the church is created. Move it from Central → Hierarchy.
            </Typography.Paragraph>
          </Form.Item>
        ) : (
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="countryId"
                label="Country"
                rules={[{ required: true, message: 'Choose the country node' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
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
                  optionFilterProp="label"
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
                  optionFilterProp="label"
                  placeholder="Choose deanery"
                  disabled={!dioceseId}
                  options={optionsFor('DEANERY', dioceseId)}
                  notFoundContent="No deanery under this diocese yet — create it in Central → Hierarchy."
                />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="timezone"
              label="Timezone"
              rules={[{ required: true, message: 'Choose the church timezone' }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Choose timezone"
                options={TIMEZONE_OPTIONS}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="denomination" label="Denomination">
              <Input placeholder="Lutheran" maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item name="church_style" label="Worship style">
              <Input placeholder="Traditional" maxLength={200} />
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

        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Form.Item
              name="latitude"
              label="Latitude"
              dependencies={['longitude']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_rule, value) =>
                    value === null || value === undefined || getFieldValue('longitude') != null
                      ? Promise.resolve()
                      : Promise.reject(new Error('Add the longitude too')),
                }),
              ]}
            >
              <InputNumber
                className="w-full"
                min={-90}
                max={90}
                precision={6}
                placeholder="59.437"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item
              name="longitude"
              label="Longitude"
              dependencies={['latitude']}
              rules={[
                ({ getFieldValue }) => ({
                  validator: (_rule, value) =>
                    value === null || value === undefined || getFieldValue('latitude') != null
                      ? Promise.resolve()
                      : Promise.reject(new Error('Add the latitude too')),
                }),
              ]}
            >
              <InputNumber
                className="w-full"
                min={-180}
                max={180}
                precision={6}
                placeholder="24.753"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="sunday_live_stream" label="Sunday live stream" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="taize_chants" label="Taizé chants" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={4}>
            <Form.Item name="youth_ministry" label="Youth ministry" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={saving || creating}>
            Save setup
          </Button>
          {data && canLifecycle && (
            <>
              {data.status === 'PENDING' && (
                <Button onClick={() => runLifecycle('approve')}>Approve</Button>
              )}
              {data.status === 'APPROVED' && (
                <Button onClick={() => runLifecycle('suspend')}>Suspend</Button>
              )}
              {data.status !== 'ARCHIVED' && (
                <Button onClick={() => runLifecycle('archive')}>Archive</Button>
              )}
            </>
          )}
          {data && canDelete && data.status === 'PENDING' && (
            <Button danger onClick={() => setPurgeOpen(true)}>
              Delete church
            </Button>
          )}
        </Space>

        {data && data.status === 'APPROVED' && (
          <Typography.Paragraph type="secondary" className="!mt-4 !mb-0">
            Approved on {data.approvedAt ? new Date(data.approvedAt).toLocaleString() : '—'}.
            Archive is not deletion: the record stays for reporting.
          </Typography.Paragraph>
        )}
      </Form>

      <PurgeChurchModal
        church={
          purgeOpen && data ? { id: data.id, name: data.name, version: data.version } : undefined
        }
        onClose={() => setPurgeOpen(false)}
      />
    </Card>
  )
}
