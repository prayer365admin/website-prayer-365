'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCountries, useLanguages } from '@/hooks/data/central'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { CountryData, isLanguageReady, LanguageSummary } from '@/models/registry'
import { Alert, Button, Col, Drawer, Form, Input, Row, Select, Switch, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useMemo, useState } from 'react'

/*
 * Country (S22) and language (S23) registries share one screen. Rows are
 * never removed from the UI: disabling keeps every existing reference intact.
 */

type RegistryRow = CountryData & Partial<Pick<LanguageSummary, 'ready'>>
type FormValues = { code: string; name: string; enabled: boolean }
type Toggle = 'yes' | 'no' | undefined

const CONFIG = {
  country: {
    title: 'Countries',
    description:
      'Maintain the supported country registry. Country choice does not set a user’s interface language.',
    subject: 'prayer_country',
    entity: 'country',
    codeRule: { pattern: /^[A-Z]{2}$/, message: 'Use a 2-letter uppercase ISO code, e.g. EE' },
    codePlaceholder: 'EE',
  },
  language: {
    title: 'Languages',
    description:
      'Manage the supported language registry. Adding a language does not create translations.',
    subject: 'prayer_language',
    entity: 'language',
    codeRule: {
      pattern: /^[a-z]{2}(?:-[A-Za-z0-9]+)*$/,
      message: 'Use a BCP-47 language tag, e.g. et',
    },
    codePlaceholder: 'et',
  },
} as const

const matches = (flag: boolean | undefined, filter: Toggle) =>
  filter === undefined || Boolean(flag) === (filter === 'yes')

export default function ContentsCentralRegistry({ kind }: { kind: 'country' | 'language' }) {
  const config = CONFIG[kind]
  const countries = useCountries(kind === 'country')
  const languages = useLanguages(kind === 'language')
  const registry = kind === 'country' ? countries : languages
  const rows = registry.data as RegistryRow[] | undefined

  const permission = useAccessPermission()
  const canCreate = permission.createAny(config.subject).granted
  const canUpdate = permission.updateAny(config.subject).granted

  const [search, setSearch] = useState<string | undefined>('')
  const [active, setActive] = useState<Toggle>()
  const [ready, setReady] = useState<Toggle>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const [editing, setEditing] = useState<RegistryRow | 'new'>()
  const [form] = Form.useForm<FormValues>()
  const formCode = Form.useWatch('code', form)
  const formEnabled = Form.useWatch('enabled', form)

  // ponytail: filters run client-side over the single fetched page (≤100 rows);
  // move to server params if a registry outgrows it.
  const filtered = useMemo(() => {
    const term = search?.trim().toLowerCase()
    return (rows ?? []).filter(
      (row) =>
        (!term || row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term)) &&
        matches(row.enabled, active) &&
        (kind !== 'language' || matches(row.ready, ready)),
    )
  }, [rows, search, active, ready, kind])

  // Readiness only gates enabling; disabling is always allowed.
  const enableBlocked =
    kind === 'language' &&
    !formEnabled &&
    (editing === 'new' ? !isLanguageReady(formCode ?? '') : editing?.ready === false)

  const openDrawer = (row: RegistryRow | 'new') => {
    setEditing(row)
    form.setFieldsValue(
      row === 'new'
        ? { code: '', name: '', enabled: false }
        : { code: row.code, name: row.name, enabled: row.enabled },
    )
  }

  const submit = async (values: FormValues) => {
    if (editing === 'new') {
      await registry.onCreate({
        code: values.code.trim(),
        name: values.name.trim(),
        enabled: Boolean(values.enabled),
      })
    } else if (editing) {
      await registry.onUpdate({
        code: editing.code,
        payload: {
          version: editing.version,
          name: values.name.trim(),
          enabled: Boolean(values.enabled),
        },
      })
    }
    setEditing(undefined)
  }

  const columns: ColumnsType<RegistryRow> = [
    { key: 'code', title: 'Code', dataIndex: 'code', width: 100 },
    { key: 'name', title: 'Name', dataIndex: 'name' },
    {
      key: 'status',
      title: 'Status',
      render: (_, row) =>
        row.enabled ? <Tag color="green">Active</Tag> : <Tag color="default">Inactive</Tag>,
    },
    ...(kind === 'language'
      ? [
          {
            key: 'ready',
            title: 'Translations',
            render: (_: unknown, row: RegistryRow) =>
              row.ready ? <Tag color="blue">Ready</Tag> : <Tag>Not ready</Tag>,
          },
        ]
      : []),
    ...(canUpdate
      ? [
          {
            key: 'actions',
            title: '',
            render: (_: unknown, row: RegistryRow) => (
              <Button size="small" onClick={() => openDrawer(row)}>
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ]

  const toggleOptions = (yes: string, no: string) => [
    { label: yes, value: 'yes' },
    { label: no, value: 'no' },
  ]

  return (
    <>
      <DashboardMainHeader title={config.title} description={config.description}>
        {canCreate && (
          <Col>
            <Button type="primary" size="large" onClick={() => openDrawer('new')}>
              Add {config.entity}
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

      <Row justify="space-between" className="mb-2">
        <Col className="w-full lg:w-[50%] flex gap-2">
          <Select
            allowClear
            className="w-full md:w-40"
            placeholder="Filter status"
            value={active}
            onChange={(value) => {
              setActive(value)
              setPage(1)
            }}
            options={toggleOptions('Active', 'Inactive')}
          />
          {kind === 'language' && (
            <Select
              allowClear
              className="w-full md:w-48"
              placeholder="Filter translations"
              value={ready}
              onChange={(value) => {
                setReady(value)
                setPage(1)
              }}
              options={toggleOptions('Translations ready', 'Not ready')}
            />
          )}
        </Col>
        <Col className="w-full lg:w-[50%]">
          <SearchInput
            placeholder="Search by name or code"
            setValue={setSearch}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </Col>
      </Row>

      {registry.error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message={`${config.title} could not be loaded`}
          description="Refresh the page or try again shortly."
        />
      )}

      <Table
        size="small"
        rowKey="code"
        columns={columns}
        dataSource={filtered}
        loading={registry.loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: filtered.length,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage)
            setPageSize(nextSize)
          },
        }}
      />

      <Drawer
        title={editing === 'new' ? `Add ${config.entity}` : `Edit ${config.entity}`}
        open={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        destroyOnHidden
        extra={
          <Button type="primary" loading={registry.saving} onClick={() => form.submit()}>
            Save
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            name="code"
            label="Code"
            rules={editing === 'new' ? [{ required: true }, config.codeRule] : []}
          >
            <Input disabled={editing !== 'new'} placeholder={config.codePlaceholder} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="Active"
            valuePropName="checked"
            extra={
              enableBlocked
                ? 'This language can be activated once its translations are ready.'
                : 'Inactive entries stay linked to existing records.'
            }
          >
            <Switch aria-label="Active" disabled={enableBlocked} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  )
}
