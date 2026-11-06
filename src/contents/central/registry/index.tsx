'use client'

import { CloseOutlined, EditOutlined } from '@ant-design/icons'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCountries, useLanguages } from '@/hooks/data/central'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { CountryData, isLanguageReady, LanguageSummary } from '@/models/registry'
import { Alert, Button, ConfigProvider, Drawer, Form, Input, Select, Switch, Table } from 'antd'
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
    label: 'Country',
    codeRule: { pattern: /^[A-Z]{2}$/, message: 'Use a 2-letter uppercase ISO code, e.g. EE' },
    codePlaceholder: 'EE',
  },
  language: {
    title: 'Languages',
    description:
      'Manage the supported language registry. Adding a language does not create translations.',
    subject: 'prayer_language',
    entity: 'language',
    label: 'Language',
    codeRule: {
      pattern: /^[a-z]{2}(?:-[A-Za-z0-9]+)*$/,
      message: 'Use a BCP-47 language tag, e.g. et',
    },
    codePlaceholder: 'et',
  },
} as const

/**
 * Flag artwork comes from the ISO code, so no image column is stored per row.
 * flagcdn only publishes ISO-3166 codes, so the registry's few legacy aliases
 * (the UK row is stored as `UK`, not `GB`) are mapped to their ISO code here.
 */
const FLAG_CODE_ALIASES: Record<string, string> = { UK: 'GB' }

export const countryFlagUrl = (code: string) => {
  const iso = FLAG_CODE_ALIASES[code.trim()] ?? code.trim()
  return `https://flagcdn.com/h80/${iso.toLowerCase()}.png`
}

const matches = (flag: boolean | undefined, filter: Toggle) =>
  filter === undefined || Boolean(flag) === (filter === 'yes')

const StatusPill = ({
  enabled,
  onLabel = 'Active',
  offLabel = 'Inactive',
}: {
  enabled: boolean
  onLabel?: string
  offLabel?: string
}) => (
  <span
    className={`inline-flex h-[26px] w-fit items-center gap-[6px] rounded-full border px-[10px] text-xs font-semibold ${
      enabled
        ? 'border-[#D3FAEF] bg-[#EDFDF9] text-[#09A97C]'
        : 'border-[#DDE0E4] bg-[#F6F6F6] text-[#B0B6BF]'
    }`}
  >
    <span className="h-[6px] w-[6px] rounded-full bg-current" />
    {enabled ? onLabel : offLabel}
  </span>
)

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
        matches(row.enabled, active),
    )
  }, [rows, search, active])

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
    {
      key: 'code',
      title: 'Code',
      dataIndex: 'code',
      width: 80,
      // Stored tags stay lowercase (BCP-47); the column reads as a display code.
      render: (code: string) => (
        <span className="text-sm font-semibold text-[#0E203E]">{code.toUpperCase()}</span>
      ),
    },
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      render: (name: string, row) => (
        <div className="flex items-center gap-2">
          {kind === 'country' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={countryFlagUrl(row.code)}
              alt={name}
              width={32}
              height={32}
              onError={(event) => {
                event.currentTarget.style.visibility = 'hidden'
              }}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          )}
          <span className="text-sm font-semibold text-[#0E203E]">{name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (_, row) => <StatusPill enabled={row.enabled} />,
    },
    ...(kind === 'language'
      ? [
          {
            key: 'ready',
            title: 'Translations',
            render: (_: unknown, row: RegistryRow) => (
              <StatusPill enabled={Boolean(row.ready)} onLabel="Ready" offLabel="Not ready" />
            ),
          },
        ]
      : []),
    ...(canUpdate
      ? [
          {
            key: 'actions',
            title: '',
            width: 56,
            align: 'right' as const,
            render: (_: unknown, row: RegistryRow) => (
              <Button
                aria-label="Edit"
                onClick={() => openDrawer(row)}
                className="!flex !h-8 !w-8 !items-center !justify-center !rounded-lg !border-[#DDE0E4] !bg-white !text-[#5C6370] hover:!border-[#2F7AD2] hover:!text-[#2F7AD2]"
              >
                <EditOutlined style={{ fontSize: 14 }} />
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
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold leading-tight text-primary-900 m-0">
            {config.title}
          </h1>
          <p className="mt-2 mb-0 text-sm text-neutral-600">{config.description}</p>
        </div>
        {kind === 'language' && canCreate && (
          <Button
            type="primary"
            size="large"
            className="w-full sm:w-auto"
            onClick={() => openDrawer('new')}
          >
            Add {config.label}
          </Button>
        )}
      </div>

      {registry.error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message={`${config.title} could not be loaded`}
          description="Refresh the page or try again shortly."
        />
      )}

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col">
        <div className="box-border flex flex-row flex-wrap items-center px-6 py-4 gap-2 border-b border-[#dde0e4] bg-white shrink-0">
          <div className="w-full sm:w-[280px] sm:max-w-[280px]">
            <SearchInput
              placeholder="Search by name or code"
              iconPosition="prefix"
              setValue={setSearch}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          </div>
          {/* Ant Design 6 renders the select's box on the root and its text in
              `.ant-select-content`; `.ant-select-selector` no longer exists, so
              the height/colour hooks target the v6 classes to match the 40px
              search field beside it. */}
          <Select
            allowClear
            aria-label="Filter status"
            className="w-full sm:w-[123px] !h-10 !rounded-lg !border-[#DDE0E4] !px-3 [&_.ant-select-content]:!h-full [&_.ant-select-content]:!items-center [&_.ant-select-content-value]:!inline-flex [&_.ant-select-content-value]:!h-full [&_.ant-select-content-value]:!items-center [&_.ant-select-content-value]:!text-sm [&_.ant-select-content-value]:!text-[#0E203E] [&_.ant-select-placeholder]:!inline-flex [&_.ant-select-placeholder]:!h-full [&_.ant-select-placeholder]:!items-center [&_.ant-select-placeholder]:!text-sm [&_.ant-select-placeholder]:!text-[#0E203E]/45"
            placeholder="All Status"
            value={active}
            onChange={(value) => {
              setActive(value)
              setPage(1)
            }}
            options={toggleOptions('Active', 'Inactive')}
          />
        </div>

        <div className="bg-white flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table]:!bg-white [&_.ant-table-thead_>_tr_>_th]:!bg-[#fafafb] [&_.ant-table-thead_>_tr_>_th]:!text-neutral-600 [&_.ant-table-thead_>_tr_>_th]:!text-xs [&_.ant-table-thead_>_tr_>_th]:!font-semibold [&_.ant-table-thead_>_tr_>_th]:!py-2 [&_.ant-table-thead_>_tr_>_th]:!px-4 [&_.ant-table-thead_>_tr_>_th]:!h-[34px] [&_.ant-table-thead_>_tr_>_th]:!border-b [&_.ant-table-thead_>_tr_>_th]:!border-[#dde0e4] [&_.ant-table-row_>_td]:!py-4 [&_.ant-table-row_>_td]:!px-4 [&_.ant-table-row_>_td]:!border-b [&_.ant-table-row_>_td]:!border-[#dde0e4] [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
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
      </div>

      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(undefined)}
        size={576}
        placement="right"
        closeIcon={false}
        destroyOnHidden
        rootClassName="[&_.ant-drawer-content-wrapper]:!w-[calc(100vw-2rem)] sm:[&_.ant-drawer-content-wrapper]:!w-[576px] [&_.ant-drawer-content-wrapper]:!max-w-[calc(100vw-2rem)] sm:[&_.ant-drawer-content-wrapper]:!max-w-[576px] [&_.ant-drawer-content-wrapper]:!right-4 sm:[&_.ant-drawer-content-wrapper]:!right-6 [&_.ant-drawer-content-wrapper]:!top-4 sm:[&_.ant-drawer-content-wrapper]:!top-6 [&_.ant-drawer-content-wrapper]:!bottom-4 sm:[&_.ant-drawer-content-wrapper]:!bottom-6 [&_.ant-drawer-content-wrapper]:!h-[calc(100vh-2rem)] sm:[&_.ant-drawer-content-wrapper]:!h-[calc(100vh-3rem)] [&_.ant-drawer-content-wrapper]:!max-h-[880px] [&_.ant-drawer-content-wrapper]:!my-auto [&_.ant-drawer-content-wrapper]:!p-0 [&_.ant-drawer-content-wrapper]:!shadow-none [&_.ant-drawer-content]:!rounded-2xl [&_.ant-drawer-content]:!overflow-hidden [&_.ant-drawer-content]:!shadow-2xl [&_.ant-drawer-content]:!h-full [&_.ant-drawer-content]:!bg-white [&_.ant-drawer-body]:!p-0 [&_.ant-drawer-body]:!flex [&_.ant-drawer-body]:!flex-col [&_.ant-drawer-body]:!h-full [&_.ant-drawer-body]:!overflow-hidden [&_.ant-drawer-mask]:!bg-[#0e203e]/35"
        styles={{
          wrapper: {
            boxSizing: 'border-box',
            maxWidth: 'calc(100vw - 2rem)',
            width: 'min(576px, calc(100vw - 2rem))',
          },
          section: {
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(14, 32, 62, 0.15)',
            maxHeight: 880,
            margin: 'auto 0',
          },
          body: {
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          },
        }}
      >
        <div className="flex h-full flex-col bg-white">
          <div className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-[#DDE0E4] px-4 py-4">
            <h2 className="m-0 text-base font-semibold leading-[24px] text-[#0E203E]">
              {editing === 'new' ? `New ${config.label}` : `Edit ${config.label}`}
            </h2>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={() => setEditing(undefined)}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#DDE0E4] bg-white text-[#5C6370] hover:border-[#2F7AD2] hover:text-[#2F7AD2]"
            >
              <CloseOutlined style={{ fontSize: 14 }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-5">
              <Form
                form={form}
                layout="vertical"
                onFinish={submit}
                className="flex flex-col gap-5 [&_.ant-form-item]:!mb-0 [&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!font-semibold [&_.ant-form-item-label>label]:!text-[#0E203E] [&_.ant-form-item-extra]:!mt-2 [&_.ant-form-item-extra]:!text-sm [&_.ant-form-item-extra]:!text-[#5C6370]"
              >
                <Form.Item
                  name="code"
                  label="Code"
                  rules={editing === 'new' ? [{ required: true }, config.codeRule] : []}
                >
                  <Input
                    disabled={editing !== 'new'}
                    placeholder={config.codePlaceholder}
                    className={`!h-10 !rounded-lg !border !px-3 !text-sm ${
                      editing === 'new'
                        ? '!border-[#737C8C] !bg-white !text-[#0E203E]'
                        : '!border-[#DDE0E4] !bg-[#F6F6F6] !text-[#B0B6BF]'
                    }`}
                  />
                </Form.Item>
                <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
                  <Input
                    maxLength={200}
                    placeholder="Estonia"
                    className="!h-10 !rounded-lg !border-[#737C8C] !bg-white !px-3 !text-sm !text-[#0E203E] placeholder:!text-[#0E203E]/45"
                  />
                </Form.Item>
                {kind === 'country' && (
                  <div className="flex items-center gap-4 rounded-xl bg-[#F5F7FF] p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={countryFlagUrl(formCode ?? '')}
                      alt="Country flag"
                      width={77}
                      height={77}
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden'
                      }}
                      className="h-[77px] w-[77px] shrink-0 rounded-lg object-cover"
                    />
                    <p className="m-0 min-w-0 flex-1 text-sm leading-[21px] text-[#5C6370]">
                      Country flag or icon in a 1:1 square dimension.
                    </p>
                  </div>
                )}
                {/* Design switch is 83×32 with a 26px knob; antd sizes both from tokens
                    that a className cannot reach without breaking the thumb/track maths.
                    The provider wraps the whole item (not the control) because Form.Item
                    injects `checked`/`onChange` into its direct child only. */}
                <ConfigProvider
                  theme={{
                    // The inner labels set their own font-size from this token, so the
                    // className cannot shrink them: 12px is what fits "Inactive".
                    token: { fontSizeSM: 12 },
                    components: {
                      Switch: {
                        trackHeight: 32,
                        trackMinWidth: 83,
                        handleSize: 26,
                        trackPadding: 3,
                        // antd derives both margins from the handle size; the 26px
                        // knob would sit on top of the labels with those defaults.
                        // 8 + 44 (label) + 31 = the 83px track exactly.
                        innerMinMargin: 8,
                        innerMaxMargin: 31,
                      },
                    },
                  }}
                >
                  <Form.Item
                    name="enabled"
                    label="Status"
                    valuePropName="checked"
                    extra={
                      enableBlocked
                        ? 'This language can be activated once its translations are ready.'
                        : 'Inactive entries stay linked to existing records.'
                    }
                  >
                    <Switch
                      aria-label="Active"
                      disabled={enableBlocked}
                      checkedChildren="Active"
                      unCheckedChildren="Inactive"
                      className="[&_.ant-switch-handle::before]:!bg-white [&:not(.ant-switch-checked)]:!bg-[#E9EAEC] [&_.ant-switch-inner-unchecked]:!text-[#5C6370]"
                    />
                  </Form.Item>
                </ConfigProvider>
              </Form>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#F1F5F9] bg-white px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                className="!h-10 !rounded-lg !border-0 !bg-[#E6EDFB] !px-4 !text-sm !font-semibold !text-[#2555A7]"
                onClick={() => setEditing(undefined)}
                disabled={registry.saving}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                className="!h-10 !rounded-lg !bg-[#2F7AD2] !px-4 !text-sm !font-semibold"
                loading={registry.saving}
                onClick={() => form.submit()}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  )
}
