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
    <div className="flex flex-1 flex-col">
      <DashboardMainHeader title={config.title} description={config.description}>
        {canCreate && (
          <Col>
            <Button type="primary" size="large" onClick={() => openDrawer('new')}>
              Add {config.entity}
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

      <Row justify="space-between" className="mb-2 shrink-0">
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

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table]:!bg-white [&_.ant-table-thead_>_tr_>_th]:!bg-[#fafafb] [&_.ant-table-thead_>_tr_>_th]:!text-neutral-600 [&_.ant-table-thead_>_tr_>_th]:!text-xs [&_.ant-table-thead_>_tr_>_th]:!font-semibold [&_.ant-table-thead_>_tr_>_th]:!py-2 [&_.ant-table-thead_>_tr_>_th]:!px-4 [&_.ant-table-thead_>_tr_>_th]:!h-[34px] [&_.ant-table-thead_>_tr_>_th]:!border-b [&_.ant-table-thead_>_tr_>_th]:!border-[#dde0e4] [&_.ant-table-row_>_td]:!py-4 [&_.ant-table-row_>_td]:!px-4 [&_.ant-table-row_>_td]:!border-b [&_.ant-table-row_>_td]:!border-[#dde0e4] [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
        <Table
          size="small"
          rowKey="code"
          columns={columns}
          dataSource={filtered}
          loading={registry.loading}
          scroll={{ x: 'max-content' }}
          className="flex-1 flex flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination]:!mt-auto [&_.ant-table-thead_th]:!whitespace-nowrap [&_.ant-table-cell]:!whitespace-nowrap"
          pagination={{
            current: page,
            pageSize,
            total: filtered.length,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `Showing ${range[0]} - ${range[1]} of ${total.toLocaleString()} ${config.entity.toLowerCase()}s`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage)
              setPageSize(nextSize)
            },
          }}
        />
      </div>

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
    </div>
  )
}
