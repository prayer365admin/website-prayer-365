'use client'

import { useCustomers } from '@/hooks/data/customer'
import { useUrlPagination } from '@/hooks/ui/url-pagination'
import { Table } from 'antd'
import { Fragment } from 'react'
import { CustomerColumns } from './columns'

export default function ContentsCustomer() {
  const { page, pageSize, setPage, setPageSize } = useUrlPagination()
  const {
    data: customerData,
    loading: customerLoading,
    total: customerTotal,
  } = useCustomers({
    queryString: ``,
    limit: pageSize,
    page,
    orderBy: 'created_at',
    orderDirection: 'desc',
  })

  const columns = CustomerColumns({ page, pageSize })

  return (
    <Fragment>
      <div>
        <Table
          columns={columns}
          dataSource={customerData}
          loading={customerLoading}
          key={'customer-table'}
          rowKey={'id'}
          pagination={{
            total: customerTotal,
            current: page,
            pageSize: pageSize,
            onChange: (current, size) => {
              setPage(current)
              setPageSize(size)
            },
          }}
        />
      </div>
    </Fragment>
  )
}
