import { CustomerDataModel } from '@/hooks/data/customer'
import { render, screen } from '@testing-library/react'
import { Table } from 'antd'
import { describe, expect, it } from 'vitest'
import { CustomerColumns } from './columns'

const verifiedRow: CustomerDataModel = {
  id: 'c1',
  name: 'Alice',
  email: 'alice@x.com',
  email_verified_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
}

describe('CustomerColumns', () => {
  it('shows name, email, type tag, verified status, and formatted registered date', () => {
    render(
      <Table<CustomerDataModel>
        columns={CustomerColumns()}
        dataSource={[verifiedRow]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('alice@x.com')).toBeTruthy()
    expect(screen.getAllByText('Customer').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(new Date(verifiedRow.created_at).toLocaleDateString())).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  it('renders login provider, unverified status, and relative last active', () => {
    const unverifiedRow = {
      id: 'c2',
      name: 'Bob',
      email: 'bob@x.com',
      email_verified_at: null,
      last_login_provider: 'google',
      last_active_at: new Date().toISOString(),
      created_at: '2026-01-02T00:00:00Z',
    }
    render(
      <Table<CustomerDataModel>
        columns={CustomerColumns()}
        dataSource={[unverifiedRow]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('Google')).toBeTruthy()
    expect(screen.getByText('Unverified')).toBeTruthy()
    expect(screen.getByText('1 minute ago')).toBeTruthy()
  })
})
