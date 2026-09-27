'use client'

import AddButton from '@/components/common/add-button'
import SearchInput from '@/components/common/search-input'
import { useUsers } from '@/hooks/data/user'
import { Table, TablePaginationConfig } from 'antd'
import { useRouter } from 'next/navigation'
import { Fragment, useState } from 'react'
import { UserColumns } from './columns'

export default function ContentsUserManagementUser() {
  const router = useRouter()

  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [sort, setSort] = useState<{ orderBy: string; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'created_at',
    orderDirection: 'desc',
  })
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

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
  })

  const columns = UserColumns({ onDelete: deleteUser })
  return (
    <Fragment>
      <div>
        <div className="flex justify-between items center">
          <div className="w-[50%]">
            <SearchInput setValue={setSearchValue} setPage={setPage} setPageSize={setPageSize} />
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
