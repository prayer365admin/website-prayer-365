import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatMinorToMajor, PaymentStateTag, ProviderStateTag } from './columns'

describe('columns - formatMinorToMajor', () => {
  it('formats "0" to USD 0.00', () => {
    expect(formatMinorToMajor('0', 'USD')).toBe('USD 0.00')
  })

  it('formats "99" to USD 0.99', () => {
    expect(formatMinorToMajor('99', 'USD')).toBe('USD 0.99')
  })

  it('formats negative number -1234 to -USD 12.34', () => {
    expect(formatMinorToMajor(-1234, 'USD')).toBe('-USD 12.34')
  })

  it('formats bigint 1234567n with en-US thousands separator to USD 12,345.67', () => {
    expect(formatMinorToMajor(BigInt(1234567), 'USD')).toBe('USD 12,345.67')
  })

  it('uppercases lowercase currency input', () => {
    expect(formatMinorToMajor('500', 'usd')).toBe('USD 5.00')
    expect(formatMinorToMajor('1234567', 'eur')).toBe('EUR 12,345.67')
  })
})

describe('columns - PaymentStateTag', () => {
  it('renders Confirmed for paid', () => {
    render(<PaymentStateTag status="paid" />)
    expect(screen.getByText('Confirmed')).toBeTruthy()
  })

  it('renders Failed for failed', () => {
    render(<PaymentStateTag status="failed" />)
    expect(screen.getByText('Failed')).toBeTruthy()
  })

  it('renders Refunded for refunded', () => {
    render(<PaymentStateTag status="refunded" />)
    expect(screen.getByText('Refunded')).toBeTruthy()
  })

  it('renders Pending for undefined status', () => {
    render(<PaymentStateTag status={undefined} />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('renders Pending for unknown status', () => {
    render(<PaymentStateTag status="unknown_state" />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })
})

describe('columns - ProviderStateTag', () => {
  it('renders Active for active', () => {
    render(<ProviderStateTag status="active" />)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('renders Past due for past_due', () => {
    render(<ProviderStateTag status="past_due" />)
    expect(screen.getByText('Past due')).toBeTruthy()
  })

  it('renders Canceled for canceled', () => {
    render(<ProviderStateTag status="canceled" />)
    expect(screen.getByText('Canceled')).toBeTruthy()
  })

  it('renders Incomplete for incomplete', () => {
    render(<ProviderStateTag status="incomplete" />)
    expect(screen.getByText('Incomplete')).toBeTruthy()
  })

  it('passes unknown string through raw', () => {
    render(<ProviderStateTag status="paused" />)
    expect(screen.getByText('paused')).toBeTruthy()
  })

  it('renders Unknown for undefined status', () => {
    render(<ProviderStateTag status={undefined} />)
    expect(screen.getByText('Unknown')).toBeTruthy()
  })
})
