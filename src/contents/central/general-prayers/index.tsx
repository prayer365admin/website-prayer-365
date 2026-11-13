'use client'

import AddButton from '@/components/common/add-button'
import SearchInput from '@/components/common/search-input'
import {
  useCreateGeneralPrayer,
  useGeneralPrayerActiveCount,
  useGeneralPrayers,
} from '@/hooks/data/general-prayer'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import type { GeneralPrayerCreate } from '@/models/general-prayer'
import { sequenceFor, todayInTallinn } from '@/utils/general-prayer-cycle'
import { CloseOutlined } from '@ant-design/icons'
import {
  Alert,
  ConfigProvider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Typography,
} from 'antd'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { GeneralPrayerColumns } from './columns'
import GeneralPrayerBodyField from './body-field'

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
] as const

type CreateValues = {
  sequence: number
  title: string
  body: string
  introduction?: string
  verse?: string
  verseReference?: string
  languageCode: string
}

export default function ContentsCentralGeneralPrayers() {
  const router = useRouter()
  const [search, setSearch] = useState<string | undefined>('')
  const [isActive, setIsActive] = useState<'true' | 'false' | undefined>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm<CreateValues>()

  const { data, total, loading, error } = useGeneralPrayers({
    page,
    limit: pageSize,
    search: search || undefined,
    isActive: isActive === undefined ? undefined : isActive === 'true',
  })
  const { onCreate, loading: creating } = useCreateGeneralPrayer()

  /*
   * GP-UI-06: the header line must match what the send job resolves — one
   * prayer per day cycling over the ACTIVE rows in sequence order, so the
   * count is the dedicated active count, never the table's filtered total.
   */
  const activeCount = useGeneralPrayerActiveCount()
  const todaySequence = useMemo(() => {
    if (activeCount < 1) return null
    const { dateISO } = todayInTallinn()
    return { dateISO, sequence: sequenceFor(dateISO, activeCount) }
  }, [activeCount])
  const todayTitle = todaySequence
    ? data.find((row) => row.sequence === todaySequence.sequence)?.title
    : undefined

  const openCreate = () => {
    form.resetFields()
    setCreateOpen(true)
  }

  const submitCreate = async (values: CreateValues) => {
    const payload: GeneralPrayerCreate = {
      sequence: values.sequence,
      title: values.title.trim(),
      body: values.body,
      introduction: values.introduction?.trim() || null,
      verse: values.verse?.trim() || null,
      verseReference: values.verseReference?.trim() || null,
      languageCode: values.languageCode,
      isActive: true,
    }
    const created = await onCreate(payload)
    setCreateOpen(false)
    router.push(`/dashboard/central/general-prayers/${created.id}`)
  }

  return (
    <section className="flex flex-1 flex-col gap-4">
      {error && (
        <Alert
          showIcon
          type="error"
          message="General prayers could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-primary-900 m-0 leading-tight">
          General Prayers
        </h1>
        <p className="text-sm font-normal text-neutral-600 m-0 leading-normal">
          Platform daily prayers. One is sent to everyone at 07:00 Europe/Tallinn, cycling through
          the active prayers.
        </p>
        {todaySequence && (
          <p className="text-[13px] font-semibold text-primary-700 m-0">
            Today → sequence {todaySequence.sequence}
            {todayTitle ? ` (${todayTitle})` : ''} · {todaySequence.dateISO}
          </p>
        )}
      </div>

      <div className="flex justify-end shrink-0">
        <AddButton
          label="New Prayer"
          onClick={openCreate}
          permissionSubject="prayer_general_prayer"
          className="mb-0 flex items-center justify-end"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-[#dde0e4]">
          <div className="w-[280px] max-w-[280px]">
            <SearchInput
              iconPosition="prefix"
              loading={loading}
              placeholder="Search General Prayer"
              setPage={setPage}
              setPageSize={setPageSize}
              setValue={setSearch}
            />
          </div>
          <div className="w-[160px]">
            <Select
              allowClear
              aria-label="Filter status"
              className="w-full"
              onChange={(value) => {
                setIsActive(value)
                setPage(1)
              }}
              options={STATUS_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              placeholder="All Status"
              value={isActive}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 [&_.ant-pagination]:px-4">
          <Table
            columns={GeneralPrayerColumns({
              page,
              pageSize,
              onOpen: (id) => router.push(`/dashboard/central/general-prayers/${id}`),
            })}
            dataSource={data}
            loading={loading}
            locale={{
              emptyText: (
                <div className="py-10 text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
                  No general prayers yet. Once prayers are added, the daily send cycles through the
                  active ones in sequence order and starts again from position 1 after the last.
                </div>
              ),
            }}
            onChange={(pagination) => {
              if (pagination.current) setPage(pagination.current)
              if (pagination.pageSize) setPageSize(pagination.pageSize)
            }}
            pagination={{
              current: page,
              pageSize,
              showLessItems: true,
              showSizeChanger: false,
              showTotal: (count, range) =>
                `Showing ${range[0]} - ${range[1]} of ${count.toLocaleString()} prayers`,
              total,
            }}
            rowKey="id"
            scroll={{ x: 'max-content' }}
            size="small"
          />
        </div>
      </div>

      <ConfigProvider
        theme={{
          components: {
            Form: { labelHeight: 'auto', verticalLabelPadding: '0 0 6px', labelColor: '#0E203E' },
          },
        }}
      >
        <Drawer
          afterOpenChange={(open) => {
            if (!open) form.resetFields()
          }}
          closeIcon={<CloseOutlined aria-hidden />}
          destroyOnHidden
          footer={null}
          onClose={() => setCreateOpen(false)}
          open={createOpen}
          rootClassName="general-prayer-create-drawer"
          size="large"
          title="New General Prayer"
        >
          <Form<CreateValues>
            disabled={creating}
            form={form}
            initialValues={{ languageCode: 'et' }}
            layout="vertical"
            onFinish={submitCreate}
          >
            <Typography.Paragraph className="!text-neutral-600" type="secondary">
              The cycle position is permanent: the public URL and the daily send both derive from
              it. The prayer becomes position {total + 1} in a cycle of the active prayers.
            </Typography.Paragraph>
            <Form.Item<CreateValues>
              label="Cycle position"
              name="sequence"
              rules={[{ required: true, message: 'Cycle position is required.' }]}
            >
              <InputNumber
                aria-label="Cycle position"
                className="!w-40"
                min={1}
                max={10_000}
                precision={0}
              />
            </Form.Item>
            <Form.Item<CreateValues>
              label="Title"
              name="title"
              rules={[{ required: true, message: 'Title is required.' }]}
            >
              <Input aria-label="Title" maxLength={500} placeholder="Prayer title" />
            </Form.Item>
            <Form.Item<CreateValues> label="Introduction" name="introduction">
              <Input.TextArea
                aria-label="Introduction"
                autoSize={{ minRows: 2, maxRows: 5 }}
                maxLength={4000}
                placeholder="Optional short introduction (plain text)"
              />
            </Form.Item>
            <GeneralPrayerBodyField />
            <Form.Item<CreateValues> label="Bible verse" name="verse">
              <Input.TextArea
                aria-label="Bible verse"
                autoSize={{ minRows: 1, maxRows: 4 }}
                maxLength={4000}
                placeholder="Optional verse text"
              />
            </Form.Item>
            <Form.Item<CreateValues> label="Verse reference" name="verseReference">
              <Input aria-label="Verse reference" maxLength={500} placeholder="e.g. 2Kr 5,1–10" />
            </Form.Item>
            <Form.Item<CreateValues>
              label="Content language"
              name="languageCode"
              rules={[{ required: true, message: 'Content language is required.' }]}
            >
              <Select
                aria-label="Content language"
                className="!w-40"
                options={[{ value: 'et', label: 'et — Estonian' }]}
              />
            </Form.Item>
            <button className="hidden" type="submit" aria-hidden="true" />
          </Form>
          <div className="flex justify-end gap-2">
            <button
              aria-label="Cancel creating general prayer"
              className="h-10 px-4 rounded-lg border border-[#DDE0E4] bg-white text-sm font-semibold text-neutral-600 hover:border-[#B0B6BF] hover:text-primary-900 disabled:opacity-50"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              aria-label="Create general prayer"
              className="h-10 px-4 rounded-lg bg-[#2f7ad2] border border-[#005fff] text-white text-sm font-semibold hover:bg-[#1758a6] hover:border-[#1758a6] disabled:opacity-50"
              disabled={creating}
              onClick={() => form.submit()}
              type="button"
            >
              Create prayer
            </button>
          </div>
        </Drawer>
      </ConfigProvider>
    </section>
  )
}
