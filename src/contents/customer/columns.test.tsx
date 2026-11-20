import { CustomerDataModel } from '@/hooks/data/customer'
import { render, screen } from '@testing-library/react'
import { Table } from 'antd'
import { describe, expect, it } from 'vitest'
import { CustomerColumns, formatCountdown } from './columns'

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

  it('shows Deletion pending and Deleted badges ahead of verification', () => {
    render(
      <Table<CustomerDataModel>
        columns={CustomerColumns()}
        dataSource={[
          {
            ...verifiedRow,
            id: 'p',
            status: 'deletion_pending',
            deletion_requested_at: '2026-11-19T00:00:00Z',
            deletion_grace_ends_at: new Date(
              Date.now() + 5.5 * 86_400_000 + 30 * 60_000,
            ).toISOString(),
          },
          { ...verifiedRow, id: 'd', deleted_at: '2026-11-01T00:00:00Z' },
        ]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Deletion pending')).toBeTruthy()
    expect(screen.getByText(/^5 Days 12 Hours \d+ Minutes? on /)).toBeTruthy()
    expect(screen.getByText('Deleted')).toBeTruthy()
    expect(screen.queryByText('Verified')).toBeNull()
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

describe('formatCountdown', () => {
  const now = Date.parse('2026-11-19T00:00:00Z')
  const at = (ms: number) => new Date(now + ms).toISOString()
  it('drops leading zero units and never shows seconds', () => {
    expect(formatCountdown(at(13 * 86_400_000 + 4 * 3_600_000 + 12 * 60_000 + 59_000), now)).toBe(
      '13 Days 4 Hours 12 Minutes',
    )
    expect(formatCountdown(at(3 * 3_600_000 + 60_000), now)).toBe('3 Hours 1 Minute')
    expect(formatCountdown(at(86_400_000), now)).toBe('1 Day 0 Hours 0 Minutes')
    expect(formatCountdown(at(5 * 60_000), now)).toBe('5 Minutes')
    expect(formatCountdown(at(-1000), now)).toBe('0 Minutes')
  })
})
