'use client'

import SearchInput from '@/components/common/search-input'
import { DownloadBracketIcon } from '@/components/icon/download-bracket'
import { RefreshIcon } from '@/components/icon/refresh'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { CustomerDataModel, useCustomers } from '@/hooks/data/customer'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { relativeTime } from '@/contents/user-management/user/columns'
import { exportToCsv } from '@/utils/csv'
import { LoadingOutlined } from '@ant-design/icons'
import { ConfigProvider, Select, Table, TablePaginationConfig } from 'antd'
import axios from 'axios'
import { useState } from 'react'
import { CustomerColumns } from './columns'

const CUSTOMER_EXPORT_COLUMNS = [
  { header: 'Name', accessor: (r: CustomerDataModel) => r.name },
  { header: 'Email', accessor: (r: CustomerDataModel) => r.email },
  { header: 'Type', accessor: () => 'Customer' },
  {
    header: 'Login with',
    accessor: (r: CustomerDataModel) =>
      r.last_login_provider === 'google'
        ? 'Google'
        : r.last_login_provider === 'password'
          ? 'Email & Password'
          : '—',
  },
  {
    header: 'Status',
    accessor: (r: CustomerDataModel) => (r.email_verified_at ? 'Verified' : 'Unverified'),
  },
  {
    header: 'Registered',
    accessor: (r: CustomerDataModel) =>
      r.created_at
        ? new Date(r.created_at).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '—',
  },
  {
    header: 'Last Active',
    accessor: (r: CustomerDataModel) => relativeTime(r.last_active_at),
  },
]
export default function ContentsCustomer() {
  const [isExporting, setIsExporting] = useState(false)
  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [statusValue, setStatusValue] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<{ orderBy: string; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize)
      setPage(1)
    }
  }

  const {
    data: customerData,
    loading: customerLoading,
    fetching: customerFetching,
    onRevalidate,
    total: customerTotal,
  } = useCustomers({
    queryString: '',
    search: searchValue,
    status: statusValue,
    limit: pageSize,
    page,
    orderBy: sort.orderBy,
    orderDirection: sort.orderDirection,
  })

  const columns = CustomerColumns({ page, pageSize })

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      let records: CustomerDataModel[] = customerData ?? []
      if ((customerTotal ?? 0) > records.length) {
        const totalPages = Math.ceil((customerTotal ?? 0) / 100)
        const all: CustomerDataModel[] = []
        for (let p = 1; p <= totalPages; p++) {
          const res = await axios.get(
            `/api/v1/customers?page=${p}&limit=100&order_by=${sort.orderBy}&order_direction=${sort.orderDirection}${statusValue ? `&status=${encodeURIComponent(statusValue)}` : ''}${searchValue ? `&search=${encodeURIComponent(searchValue)}` : ''}`,
          )
          all.push(...(res.data?.result || []))
        }
        if (all.length > 0) records = all
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      exportToCsv(`customers-${dateStr}.csv`, CUSTOMER_EXPORT_COLUMNS, records)
    } catch {
      const dateStr = new Date().toISOString().slice(0, 10)
      exportToCsv(`customers-${dateStr}.csv`, CUSTOMER_EXPORT_COLUMNS, customerData ?? [])
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#0E203E] tracking-tight mb-1">
            Customer Management
          </h1>
          <p className="text-sm text-[#5C6370] m-0">
            View registered mobile and web app users, login activity, and account status.
          </p>
        </div>
      </div>

      {/* Main Table Card */}
      <ConfigProvider theme={userMgmtTableTheme}>
        <div className="bg-white rounded-2xl border border-[#EEF2F7] shadow-sm overflow-hidden flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
          {/* Filter Bar */}
          <div className="p-4 border-b border-[#EEF2F7] flex items-center justify-between gap-3 overflow-x-auto shrink-0">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-[280px]">
                <SearchInput
                  placeholder="Search customer or email..."
                  setValue={setSearchValue}
                  setPage={setPage}
                  setPageSize={setPageSize}
                />
              </div>
              <div className="w-[153px]">
                <Select
                  allowClear
                  className="w-full !h-10 !rounded-lg !border-[#DDE0E4] [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-placeholder]:!leading-[38px]"
                  placeholder="All Statuses"
                  value={statusValue}
                  onChange={(value) => {
                    setStatusValue(value)
                    setPage(1)
                  }}
                  options={[
                    { value: 'verified', label: 'All Verified' },
                    { value: 'unverified', label: 'All Unverified' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting || customerLoading}
                aria-label="Export"
                aria-busy={isExporting}
                title="Export to CSV"
                className="w-10 h-10 rounded-lg border border-[#DDE0E4] bg-white flex items-center justify-center text-[#2F7AD2] hover:border-[#2F7AD2] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <LoadingOutlined className="text-base" spin />
                ) : (
                  <DownloadBracketIcon />
                )}
              </button>
              <button
                type="button"
                onClick={() => void onRevalidate()}
                disabled={customerFetching}
                aria-label="Refresh"
                aria-busy={customerFetching}
                className="w-10 h-10 rounded-lg border border-[#DDE0E4] bg-white flex items-center justify-center text-[#2F7AD2] hover:border-[#2F7AD2] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {customerFetching ? (
                  <LoadingOutlined className="text-base" spin />
                ) : (
                  <RefreshIcon />
                )}
              </button>
            </div>
          </div>

          {/* Customer Table */}
          <Table
            columns={columns}
            dataSource={customerData}
            loading={customerLoading}
            key="customer-table"
            rowKey="id"
            scroll={{ x: 'max-content' }}
            className="flex-1 flex flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination]:!mt-auto [&_.ant-table-thead_th]:!whitespace-nowrap [&_.ant-table-cell]:!whitespace-nowrap"
            onChange={(pagination, _filter, sorter) => {
              if (!Array.isArray(sorter) && (sorter.field || sorter.columnKey)) {
                setSort({
                  orderBy: (sorter.field as string) || (sorter.columnKey as string) || 'created_at',
                  orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
                })
              }
              handlePagination(pagination)
            }}
            pagination={{
              total: customerTotal,
              current: page,
              pageSize: pageSize,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `Showing ${range[0]} - ${range[1]} of ${(total ?? 0).toLocaleString()} customers`,
              onChange: (newPage) => {
                setPage(newPage)
              },
            }}
          />
        </div>
      </ConfigProvider>
    </div>
  )
}
