'use client'

import { useCustomers } from '@/hooks/data/customer'
import { Table } from 'antd'
import { Fragment, useState } from 'react'
import { CustomerColumns } from './columns'

export default function ContentsCustomer() {
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)
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

  const columns = CustomerColumns()

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
