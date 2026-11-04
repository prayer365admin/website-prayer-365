'use client'

import AddButton from '@/components/common/add-button'
import SearchInput from '@/components/common/search-input'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCentralChurchList, useCountries } from '@/hooks/data/central'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { ChurchListItem } from '@/models/central-church'
import { Alert, Breadcrumb, Empty, Select, Table, TablePaginationConfig } from 'antd'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { CentralChurchColumns } from './columns'
import ContentsCentralChurchDrawer from './drawer'
import PurgeChurchModal from './purge-modal'

const CHURCH_STATUSES = ['PENDING', 'APPROVED', 'SUSPENDED', 'ARCHIVED'] as const

/**
 * S15 — Church administration list. Every status is visible here (this is the
 * only screen that can see PENDING churches); the church-staff selector at
 * /dashboard/churches never does.
 */
export default function ContentsCentralChurches() {
  const searchParams = useSearchParams()
  // Deep links from the overview KPI cards filter by status (`?status=PENDING`).
  const statusParam = searchParams.get('status')
  const status = CHURCH_STATUSES.find((status) => status === statusParam)
  const [search, setSearch] = useState<string>()
  const [selectedCountry, setSelectedCountry] = useState<string>()
  const [selectedChurchId, setSelectedChurchId] = useState<string>()
  const [isCreating, setIsCreating] = useState(false)
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [purgeTarget, setPurgeTarget] = useState<ChurchListItem>()

  const permission = useAccessPermission()
  const canDelete =
    permission.deleteAny('prayer_church').granted || permission.deleteOwn('prayer_church').granted

  const { data: countries } = useCountries()
  const countryOptions = (countries ?? [])
    .filter((c) => c.enabled !== false)
    .map((c) => ({ value: c.code, label: c.name }))

  const { data, total, loading, error } = useCentralChurchList({
    page,
    limit: pageSize,
    search,
    status,
  })

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <div className="flex flex-1 flex-col">
      <Breadcrumb
        className="mb-4 shrink-0 [&_ol]:!flex [&_ol]:!items-center [&_.ant-breadcrumb-item]:!inline-flex [&_.ant-breadcrumb-item]:!items-center [&_.ant-breadcrumb-separator]:!inline-flex [&_.ant-breadcrumb-separator]:!items-center [&_.ant-breadcrumb-link]:!inline-flex [&_.ant-breadcrumb-link]:!items-center [&_.ant-breadcrumb-link]:!text-xs [&_.ant-breadcrumb-link]:!text-neutral-600 [&_.ant-breadcrumb-link_a]:!text-xs [&_.ant-breadcrumb-link_a]:!text-neutral-600 [&_.ant-breadcrumb-separator]:!text-xs [&_.ant-breadcrumb-separator]:!text-neutral-600"
        items={[
          {
            title: <Link href="/dashboard">Home</Link>,
          },
          {
            title: 'Church administration',
          },
        ]}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-primary-900 m-0 leading-tight">
            Church administration
          </h1>
          <p className="text-sm font-normal text-neutral-600 m-0 leading-normal">
            Create churches, place them in the hierarchy and control approval. A new church stays
            invisible to the public app until it is approved.
          </p>
        </div>
        <div className="shrink-0 w-full sm:w-auto">
          <AddButton
            label="New Church"
            loading={isCreating}
            onClick={() => setIsCreating(true)}
            permissionSubject="prayer_church"
            className="w-full sm:w-auto flex items-center justify-start sm:justify-end mb-0 [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto"
          />
        </div>
      </div>
      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Churches could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] overflow-hidden flex-1 flex flex-col">
        <div className="box-border flex flex-row items-center px-6 py-4 gap-2 border-b border-[#dde0e4] bg-white shrink-0">
          <div className="w-[280px] max-w-[280px] h-10 [&_.ant-input-affix-wrapper]:!h-10 [&_.ant-input-affix-wrapper]:!rounded-lg [&_.ant-input-affix-wrapper]:!border-[#dde0e4] [&_.ant-input-affix-wrapper]:!px-3 [&_.ant-input]:!text-sm [&_.ant-input]:!text-primary-900 [&_.ant-input::placeholder]:!text-primary-900/45 [&_.ant-input-prefix]:!text-primary-900 [&_.ant-input-prefix]:!mr-2">
            <SearchInput
              placeholder="Search church"
              iconPosition="prefix"
              setValue={setSearch}
              setPage={setPage}
              setPageSize={setPageSize}
            />
          </div>
          {/* Figma parity: the central church list API has no country/location filter; selection is visual only. */}
          <Select
            allowClear
            className="w-[156px] h-10 [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737c8c] [&_.ant-select-selector]:!px-3 [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-neutral-700 [&_.ant-select-selection-placeholder]:!text-sm [&_.ant-select-selection-placeholder]:!text-neutral-700"
            placeholder="All Location"
            value={selectedCountry}
            onChange={setSelectedCountry}
            options={countryOptions}
          />
        </div>

        <div className="bg-white flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination]:!mt-auto [&_.ant-table]:!bg-white [&_.ant-table-thead_>_tr_>_th]:!bg-[#fafafb] [&_.ant-table-thead_>_tr_>_th]:!text-neutral-600 [&_.ant-table-thead_>_tr_>_th]:!text-xs [&_.ant-table-thead_>_tr_>_th]:!font-semibold [&_.ant-table-thead_>_tr_>_th]:!py-2 [&_.ant-table-thead_>_tr_>_th]:!px-4 [&_.ant-table-thead_>_tr_>_th:first-child]:!pl-6 [&_.ant-table-thead_>_tr_>_th:last-child]:!pr-6 [&_.ant-table-thead_>_tr_>_th]:!h-[34px] [&_.ant-table-thead_>_tr_>_th]:!border-b [&_.ant-table-thead_>_tr_>_th]:!border-[#dde0e4] [&_.ant-table-measure-row]:!h-0 [&_.ant-table-measure-row_>_td]:!h-0 [&_.ant-table-measure-row_>_td]:!p-0 [&_.ant-table-measure-row_>_td]:!border-0 [&_.ant-table-row_>_td]:!py-4 [&_.ant-table-row_>_td]:!px-4 [&_.ant-table-row_>_td:first-child]:!pl-6 [&_.ant-table-row_>_td:last-child]:!pr-6 [&_.ant-table-row_>_td]:!border-b [&_.ant-table-row_>_td]:!border-[#dde0e4] [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
          <Table<ChurchListItem>
            className="flex-1 flex flex-col"
            size="small"
            rowKey="id"
            columns={CentralChurchColumns({
              canDelete,
              onOpen: (church) => setSelectedChurchId(church.id),
              onPurge: setPurgeTarget,
            })}
            dataSource={data ?? []}
            loading={loading}
            scroll={{ x: 600 }}
            locale={{ emptyText: <Empty description="No churches found." /> }}
            onChange={(pagination) => handlePagination(pagination)}
            pagination={{
              total,
              current: page,
              pageSize,
              showTotal: (total, range) =>
                `Showing ${range[0]} - ${range[1]} of ${total.toLocaleString()} churches`,
            }}
          />
        </div>
      </div>

      {selectedChurchId && (
        <ContentsCentralChurchDrawer
          churchId={selectedChurchId}
          onClose={() => setSelectedChurchId(undefined)}
        />
      )}

      {isCreating && <ContentsCentralChurchDrawer onClose={() => setIsCreating(false)} />}

      <PurgeChurchModal church={purgeTarget} onClose={() => setPurgeTarget(undefined)} />
    </div>
  )
}
