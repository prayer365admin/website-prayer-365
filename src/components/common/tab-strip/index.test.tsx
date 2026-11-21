import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TabStrip } from '.'

const ITEMS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'summary', label: 'Monthly Summary' },
] as const

const renderStrip = (value: string = 'transactions') => {
  const onChange = vi.fn()
  render(
    <TabStrip
      items={ITEMS}
      value={value as (typeof ITEMS)[number]['key']}
      onChange={onChange}
      label="Donation views"
    />,
  )
  return { onChange }
}

describe('TabStrip', () => {
  it('marks only the active tab as selected', () => {
    renderStrip('recurring')

    expect(screen.getByRole('tab', { name: 'Recurring' }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Transactions' }).getAttribute('aria-selected')).toBe(
      'false',
    )
    expect(screen.getByRole('tablist', { name: 'Donation views' })).toBeTruthy()
  })

  it('keeps a single tab stop so Tab leaves the strip', () => {
    renderStrip('transactions')

    expect(screen.getByRole('tab', { name: 'Transactions' }).tabIndex).toBe(0)
    expect(screen.getByRole('tab', { name: 'Recurring' }).tabIndex).toBe(-1)
  })

  it('moves to the next tab on ArrowRight and wraps at the end', async () => {
    const user = userEvent.setup()
    const { onChange } = renderStrip('summary')

    screen.getByRole('tab', { name: 'Monthly Summary' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).toHaveBeenCalledWith('transactions')
  })

  it('moves to the previous tab on ArrowLeft', async () => {
    const user = userEvent.setup()
    const { onChange } = renderStrip('recurring')

    screen.getByRole('tab', { name: 'Recurring' }).focus()
    await user.keyboard('{ArrowLeft}')

    expect(onChange).toHaveBeenCalledWith('transactions')
  })
})
