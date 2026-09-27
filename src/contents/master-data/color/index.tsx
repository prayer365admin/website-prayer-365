'use client'

import { Table } from 'antd'
import { Fragment } from 'react'
import AddButton from '@/components/common/add-button'

export default function ContentsMasterDataColor() {
  return (
    <Fragment>
      <div>
        <AddButton label="Create Color" />
        <Table />
      </div>
    </Fragment>
  )
}
