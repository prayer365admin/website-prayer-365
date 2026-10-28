import { render, screen } from '@testing-library/react'
import { Table } from 'antd'
import { describe, expect, it } from 'vitest'
import { CustomerColumns } from './columns'

const row = { id: 'c1', name: 'Alice', email: 'alice@x.com', created_at: '2026-01-01T00:00:00Z' }

describe('CustomerColumns', () => {
  it('shows name, email, type tag and formatted registered date', () => {
    render(
      <Table
        columns={CustomerColumns({ page: 1, pageSize: 10 })}
        dataSource={[row]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('alice@x.com')).toBeTruthy()
    expect(screen.getByText('Customer')).toBeTruthy()
    expect(screen.getByText(new Date(row.created_at).toLocaleDateString())).toBeTruthy()
  })

  it('continues row numbering on later pages', () => {
    render(
      <Table
        columns={CustomerColumns({ page: 3, pageSize: 10 })}
        dataSource={[row]}
        rowKey="id"
        pagination={false}
      />,
    )

    expect(screen.getByText('21')).toBeTruthy()
  })
})
