'use client'

import SearchInput from '@/components/common/search-input'
import RoleFilter from '@/components/common/select/role/filter'
import { DownloadBracketIcon } from '@/components/icon/download-bracket'
import { RefreshIcon } from '@/components/icon/refresh'
import { userMgmtTableTheme } from '@/config/antdTheme'
import { useUsers } from '@/hooks/data/user'
import { LoadingOutlined, UserAddOutlined } from '@ant-design/icons'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { ConfigProvider, Select, Table, TablePaginationConfig } from 'antd'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { UserColumns } from './columns'
import CreateUserModal from './create-user-modal'
import EditUserModal from './edit-user-modal'

export default function ContentsUserManagementUser() {
  const router = useRouter()

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
  return (
    <div className="min-h-screen bg-[#FAFAFB] p-4 sm:p-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
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
        <div className="bg-white rounded-2xl border border-[#EEF2F7] shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-[#EEF2F7] flex items-center justify-between gap-3 overflow-x-auto">
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
                  className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
                />
              </div>
              <div className="w-[153px]">
                <Select
                  allowClear
                  className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
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
                onClick={() => router.refresh()}
                aria-label="Export"
                className="w-10 h-10 rounded-lg border border-[#DDE0E4] bg-white flex items-center justify-center text-[#2F7AD2] hover:border-[#2F7AD2] transition-colors cursor-pointer"
              >
                <DownloadBracketIcon />
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
              showSizeChanger: true,
              showTotal: (total, range) => `Showing ${range[0]} - ${range[1]} of ${total} staff`,
              pageSizeOptions: ['5', '10', '20', '50'],
              onChange: (newPage, newPageSize) => {
                setPage(newPage)
                if (newPageSize && newPageSize !== pageSize) {
                  setPageSize(newPageSize)
                  setPage(1)
                }
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
