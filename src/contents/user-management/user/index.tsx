'use client'

import SearchInput from '@/components/common/search-input'
import RoleFilter from '@/components/common/select/role/filter'
import { DownloadBracketIcon } from '@/components/icon/download-bracket'
import { RefreshIcon } from '@/components/icon/refresh'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { useUsers } from '@/hooks/data/user'
import { LoadingOutlined, UserAddOutlined } from '@ant-design/icons'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { UserDataModel } from '@/models/user'
import { exportToCsv } from '@/utils/csv'
import { ConfigProvider, Select, Table, TablePaginationConfig } from 'antd'
import axios from 'axios'
import { useState } from 'react'
import { kindLabel, relativeTime, UserColumns } from './columns'
import CreateUserModal from './create-user-modal'
import EditUserModal from './edit-user-modal'

const STAFF_EXPORT_COLUMNS = [
  { header: 'Name', accessor: (r: UserDataModel) => r.name },
  { header: 'Email', accessor: (r: UserDataModel) => r.email },
  { header: 'Role', accessor: (r: UserDataModel) => r.role?.name || '—' },
  {
    header: 'Jurisdiction',
    accessor: (r: UserDataModel) => {
      const assignments = r.role_assignments ?? r.roleAssignments ?? []
      if (assignments.length === 0) return 'Global'
      return assignments.map((a) => `${kindLabel(a.org_node.kind)}: ${a.org_node.name}`).join('; ')
    },
  },
  {
    header: 'Status',
    accessor: (r: UserDataModel) => (r.deleted_at || r.status !== 'active' ? 'Inactive' : 'Active'),
  },
  {
    header: 'Registered',
    accessor: (r: UserDataModel) =>
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
    accessor: (r: UserDataModel) => relativeTime(r.last_active_at),
  },
]
export default function ContentsUserManagementUser() {
  const [isExporting, setIsExporting] = useState(false)

  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [roleValue, setRoleValue] = useState<string | undefined>(undefined)
  const [statusValue, setStatusValue] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<{ orderBy: string; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize && pagination.pageSize !== pageSize) {
      setPageSize(pagination.pageSize)
      setPage(1)
    }
  }

  const {
    data: userData,
    onDelete: deleteUser,
    loading: userLoading,
    fetching: userFetching,
    onRevalidate,
    total: userTotal,
  } = useUsers({
    queryString: ``,
    search: searchValue,
    orderBy: sort.orderBy,
    orderDirection: sort.orderDirection,
    limit: pageSize,
    page: page,
    role: roleValue,
    status: statusValue,
  })

  const columns = UserColumns({
    onEdit: (id: string) => setEditingId(id),
    onDelete: deleteUser,
  })

  const handleExport = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      let records: UserDataModel[] = userData ?? []
      if ((userTotal ?? 0) > records.length) {
        const totalPages = Math.ceil((userTotal ?? 0) / 100)
        const all: UserDataModel[] = []
        for (let p = 1; p <= totalPages; p++) {
          const res = await axios.get(
            `/api/v1/users?page=${p}&limit=100&order_by=${sort.orderBy}&order_direction=${sort.orderDirection}${roleValue ? `&role=${encodeURIComponent(roleValue)}` : ''}${statusValue ? `&status=${encodeURIComponent(statusValue)}` : ''}${searchValue ? `&search=${encodeURIComponent(searchValue)}` : ''}`,
          )
          all.push(...(res.data?.result || []))
        }
        if (all.length > 0) records = all
      }
      const dateStr = new Date().toISOString().slice(0, 10)
      exportToCsv(`staff-${dateStr}.csv`, STAFF_EXPORT_COLUMNS, records)
    } catch {
      const dateStr = new Date().toISOString().slice(0, 10)
      exportToCsv(`staff-${dateStr}.csv`, STAFF_EXPORT_COLUMNS, userData ?? [])
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
            Staff & Role Governance
          </h1>
          <p className="text-sm text-[#5C6370] m-0">
            Manage personnel jurisdictions, canonical role permissions, and zero-trust safeguards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="h-10 px-4 rounded-lg bg-[#2F7AD2] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#2555A7] transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
        >
          <UserAddOutlined className="text-base" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Main Table Card */}
      <ConfigProvider theme={userMgmtTableTheme}>
        <div className="bg-white rounded-2xl border border-[#EEF2F7] shadow-sm overflow-hidden flex-1 flex flex-col [&_.ant-table-wrapper]:flex-1 [&_.ant-table-wrapper]:flex [&_.ant-table-wrapper]:flex-col [&_.ant-spin]:flex-1 [&_.ant-spin]:flex [&_.ant-spin]:flex-col [&_.ant-spin-nested-loading]:flex-1 [&_.ant-spin-nested-loading]:flex [&_.ant-spin-nested-loading]:flex-col [&_.ant-spin-container]:flex-1 [&_.ant-spin-container]:flex [&_.ant-spin-container]:flex-col [&_.ant-table]:flex-1 [&_.ant-table-pagination.ant-pagination]:!mt-auto [&_.ant-table-pagination.ant-pagination]:!mb-0 [&_.ant-table-pagination.ant-pagination]:!mx-0 [&_.ant-table-pagination.ant-pagination]:!px-4 [&_.ant-table-pagination.ant-pagination]:!py-3 [&_.ant-table-pagination.ant-pagination]:!min-h-[57px] [&_.ant-table-pagination.ant-pagination]:!flex [&_.ant-table-pagination.ant-pagination]:!flex-nowrap [&_.ant-table-pagination.ant-pagination]:!items-center [&_.ant-table-pagination.ant-pagination]:!justify-between [&_.ant-table-pagination.ant-pagination]:!border-t [&_.ant-table-pagination.ant-pagination]:!border-[#dde0e4] [&_.ant-pagination-total-text]:!inline-flex [&_.ant-pagination-total-text]:!items-center [&_.ant-pagination-total-text]:!h-8 [&_.ant-pagination-total-text]:!leading-none [&_.ant-pagination-total-text]:!text-xs [&_.ant-pagination-total-text]:!text-[#8f96a3] [&_.ant-pagination-total-text]:!mr-auto [&_.ant-pagination-item]:!inline-flex [&_.ant-pagination-item]:!items-center [&_.ant-pagination-item]:!justify-center [&_.ant-pagination-item]:!p-0 [&_.ant-pagination-item]:!w-8 [&_.ant-pagination-item]:!min-w-[32px] [&_.ant-pagination-item]:!h-8 [&_.ant-pagination-item]:!rounded-lg [&_.ant-pagination-item]:!border [&_.ant-pagination-item]:!border-[#dde0e4] [&_.ant-pagination-item_a]:!flex [&_.ant-pagination-item_a]:!items-center [&_.ant-pagination-item_a]:!justify-center [&_.ant-pagination-item_a]:!w-full [&_.ant-pagination-item_a]:!h-full [&_.ant-pagination-item_a]:!p-0 [&_.ant-pagination-item_a]:!m-0 [&_.ant-pagination-item_a]:!leading-none [&_.ant-pagination-item_a]:!text-xs [&_.ant-pagination-item_a]:!font-semibold [&_.ant-pagination-item_a]:!text-neutral-600 [&_.ant-pagination-prev]:!inline-flex [&_.ant-pagination-prev]:!items-center [&_.ant-pagination-prev]:!justify-center [&_.ant-pagination-prev]:!w-8 [&_.ant-pagination-prev]:!min-w-[32px] [&_.ant-pagination-prev]:!h-8 [&_.ant-pagination-prev_.ant-pagination-item-link]:!flex [&_.ant-pagination-prev_.ant-pagination-item-link]:!items-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-prev_.ant-pagination-item-link]:!w-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!h-full [&_.ant-pagination-prev_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-prev_.ant-pagination-item-link]:!border [&_.ant-pagination-prev_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-next]:!inline-flex [&_.ant-pagination-next]:!items-center [&_.ant-pagination-next]:!justify-center [&_.ant-pagination-next]:!w-8 [&_.ant-pagination-next]:!min-w-[32px] [&_.ant-pagination-next]:!h-8 [&_.ant-pagination-next_.ant-pagination-item-link]:!flex [&_.ant-pagination-next_.ant-pagination-item-link]:!items-center [&_.ant-pagination-next_.ant-pagination-item-link]:!justify-center [&_.ant-pagination-next_.ant-pagination-item-link]:!w-full [&_.ant-pagination-next_.ant-pagination-item-link]:!h-full [&_.ant-pagination-next_.ant-pagination-item-link]:!rounded-lg [&_.ant-pagination-next_.ant-pagination-item-link]:!border [&_.ant-pagination-next_.ant-pagination-item-link]:!border-[#dde0e4] [&_.ant-pagination-item-active]:!bg-[#fafafb] [&_.ant-pagination-item-active]:!border-[#fafafb] [&_.ant-pagination-item-active_a]:!text-[#b0b6bf]">
          {/* Filter Bar */}
          <div className="p-4 border-b border-[#EEF2F7] flex items-center justify-between gap-3 overflow-x-auto shrink-0">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-[280px]">
                <SearchInput
                  placeholder="Search staff or email..."
                  setValue={setSearchValue}
                  setPage={setPage}
                  setPageSize={setPageSize}
                />
              </div>
              <div className="w-[135px]">
                <RoleFilter
                  placeholder="All Roles"
                  value={roleValue}
                  setValue={(v) => {
                    setRoleValue(v)
                    setPage(1)
                  }}
                  className="w-full !h-10 !rounded-lg !border-[#DDE0E4] [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[38px] [&_.ant-select-placeholder]:!leading-[38px]"
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
                    { value: 'active', label: 'All Active' },
                    { value: 'inactive', label: 'All Inactive' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleExport()}
                disabled={isExporting || userLoading}
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
                disabled={userFetching}
                aria-label="Refresh"
                aria-busy={userFetching}
                className="w-10 h-10 rounded-lg border border-[#DDE0E4] bg-white flex items-center justify-center text-[#2F7AD2] hover:border-[#2F7AD2] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {userFetching ? <LoadingOutlined className="text-base" spin /> : <RefreshIcon />}
              </button>
            </div>
          </div>

          {/* Staff Table */}
          <Table
            columns={columns}
            dataSource={userData}
            loading={userLoading}
            key="user-table"
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
              total: userTotal,
              current: page,
              pageSize: pageSize,
              showSizeChanger: false,
              showTotal: (total, range) =>
                `Showing ${range[0]} - ${range[1]} of ${(total ?? 0).toLocaleString()} staff`,
              onChange: (newPage) => {
                setPage(newPage)
              },
            }}
          />
        </div>
      </ConfigProvider>

      {/* Edit Scoped Role Drawer */}
      <EditUserModal
        open={Boolean(editingId)}
        userId={editingId}
        onClose={() => setEditingId(null)}
        onSaved={() => setEditingId(null)}
      />

      {/* Create Staff Member Drawer */}
      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => setCreating(false)}
      />
    </div>
  )
}
