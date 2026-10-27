'use client'

import AddButton from '@/components/common/add-button'
import SearchInput from '@/components/common/search-input'
import RoleFilter from '@/components/common/select/role/filter'
import { useUsers } from '@/hooks/data/user'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { Table, TablePaginationConfig, Select } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { UserColumns } from './columns'

export default function ContentsUserManagementUser() {
  const router = useRouter()

  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [roleValue, setRoleValue] = useState<string | undefined>(undefined)
  // Plan 023: deactivated accounts stay in the list, so they need a marker + filter.
  const [statusValue, setStatusValue] = useState<string | undefined>(undefined)
  const [sort, setSort] = useState<{ orderBy: string; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  const {
    data: userData,
    onDelete: deleteUser,
    loading: userLoading,
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

  const columns = UserColumns({ onDelete: deleteUser, page, pageSize })
  return (
    <Fragment>
      <div>
        <div className="flex justify-between items center">
          <div className="flex gap-4">
            <div className="w-[200px]">
              <RoleFilter value={roleValue} setValue={setRoleValue} />
            </div>
            <div className="w-[160px]">
              <Select
                allowClear
                className="w-full"
                placeholder="Filter status"
                value={statusValue}
                onChange={(value) => {
                  setStatusValue(value)
                  setPage(1)
                }}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>
            <div className="w-[50%]">
              <SearchInput setValue={setSearchValue} setPage={setPage} setPageSize={setPageSize} />
            </div>
          </div>
          <AddButton
            label="Create User"
            onClick={() => {
              router.push('/dashboard/user-management/user/create')
            }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={userData}
          loading={userLoading}
          key={'user-table'}
          rowKey={'id'}
          onChange={(pagination, _filter, sorter) => {
            if (!Array.isArray(sorter)) {
              setSort({
                orderBy: (sorter.columnKey as string) || '',
                orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
              })
            }
            handlePagination(pagination)
          }}
          pagination={{
            total: userTotal,
            current: page,
            pageSize: pageSize,
          }}
        />
      </div>
    </Fragment>
  )
}
