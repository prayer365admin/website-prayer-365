'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import SearchInput from '@/components/common/search-input'
import { usePastors } from '@/hooks/data/central'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { Alert, Col, Row, Select, Table, TablePaginationConfig } from 'antd'
import { useState } from 'react'
import { PastorColumns } from './columns'

export default function ContentsPastor() {
  const [searchValue, setSearchValue] = useState<string | undefined>('')
  const [sort, setSort] = useState<{ orderBy: string; orderDirection: 'asc' | 'desc' }>({
    orderBy: 'name',
    orderDirection: 'asc',
  })
  const [assignment, setAssignment] = useState<'assigned' | 'unassigned' | undefined>()
  const [staffAssignment, setStaffAssignment] = useState<'assigned' | 'unassigned' | undefined>()
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()

  const { data, total, loading, error, onDelete } = usePastors({
    search: searchValue,
    orderDirection: sort.orderDirection,
    orderBy: sort.orderBy as 'name' | 'introduction' | 'staff_account' | 'churches',
    assignment,
    staffAssignment,
    limit: pageSize,
    page,
  })

  const handlePagination = (pagination: TablePaginationConfig) => {
    if (pagination.current) setPage(pagination.current)
    if (pagination.pageSize) setPageSize(pagination.pageSize)
  }

  return (
    <>
      <DashboardMainHeader
        title="Pastor Profiles"
        description="Maintain pastor biographies and optional staff-account links."
        buttonLabel="Create Pastor"
        url="/dashboard/central/pastors/create"
        buttonPermissionSubject="prayer_pastor"
      />

      <Row justify="space-between" className="mb-2">
        <Col className="w-full lg:w-[50%] flex gap-2">
          <Select
            allowClear
            className="w-full md:w-44"
            placeholder="Filter churches"
            value={assignment}
            onChange={(value) => {
              setAssignment(value)
              setPage(1)
            }}
            options={[
              { label: 'Assigned', value: 'assigned' },
              { label: 'Not assigned', value: 'unassigned' },
            ]}
          />
          <Select
            allowClear
            className="w-full md:w-48"
            placeholder="Filter staff account"
            value={staffAssignment}
            onChange={(value) => {
              setStaffAssignment(value)
              setPage(1)
            }}
            options={[
              { label: 'Staff assigned', value: 'assigned' },
              { label: 'Staff not assigned', value: 'unassigned' },
            ]}
          />
        </Col>
        <Col className="w-full lg:w-[50%]">
          <SearchInput
            placeholder="Search name, introduction, staff, or church"
            setValue={setSearchValue}
            setPage={setPage}
            setPageSize={setPageSize}
          />
        </Col>
      </Row>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Pastor profiles could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Table
        size="small"
        key="pastor-table"
        rowKey="id"
        columns={PastorColumns({ page, pageSize, onDelete })}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        onChange={(pagination, _filters, sorter) => {
          if (!Array.isArray(sorter) && sorter.order) {
            setSort({
              orderBy: (sorter.columnKey as string) || 'name',
              orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
            })
          }
          handlePagination(pagination)
        }}
        pagination={{
          total,
          current: page,
          pageSize,
        }}
      />
    </>
  )
}
