'use client'

import { Table } from 'antd'
import { Fragment } from 'react'
import AddButton from '@/components/common/add-button'

export default function ContentsMasterDataBrand() {
  return (
    <Fragment>
      <div>
        <AddButton label="Create Brand" />
        <Table />
      </div>
    </Fragment>
  )
}
