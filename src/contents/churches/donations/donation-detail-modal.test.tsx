import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { AdminDonationRow, DonationSubscriptionRow } from '@/models/donation'
import { DonationDetailModal } from './donation-detail-modal'

const offRow: AdminDonationRow = {
  id: 'd1',
  amountMinor: '12000',
  currency: 'eur',
  status: 'PAID',
  paidAt: new Date('2025-11-24T15:05:00.000Z'),
  createdAt: new Date('2025-11-24T15:05:00.000Z'),
  ref: 'pi_1',
  churchId: 'c1',
  churchName: 'Hope Church',
  type: 'CHURCH',
  refundedMinor: '0',
  donor: { name: 'Mari', email: 'mari@example.com' },
  invoiceUrl: 'https://pay.stripe.test/receipt/abc',
}

const guestRow: AdminDonationRow = {
  ...offRow,
  id: 'd2',
  ref: 'pi_2',
  donor: null,
  invoiceUrl: null,
}

const recurringRow: DonationSubscriptionRow = {
  id: 's1',
  amountMinor: '2000',
  currency: 'eur',
  providerStatus: 'active',
  createdAt: new Date('2025-11-24T15:05:00.000Z'),
  churchId: 'c1',
  churchName: 'Hope Church',
  frequency: 'Monthly',
  invoiceUrl: 'https://pay.stripe.test/receipt/sub1',
}

describe('DonationDetailModal', () => {
  it('shows Guest for an off-donation with no donor', () => {
    render(<DonationDetailModal donation={{ kind: 'off', row: guestRow }} onClose={vi.fn()} />)

    expect(screen.getByText('Guest')).toBeTruthy()
    expect(screen.getByText('1 off donation')).toBeTruthy()
  })

  it('copies the invoice URL to the clipboard', async () => {
    const user = userEvent.setup()
    render(<DonationDetailModal donation={{ kind: 'off', row: offRow }} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Copy invoice URL/i }))

    // userEvent installs its own clipboard stub, so reading it back proves the write.
    await expect(navigator.clipboard.readText()).resolves.toBe(
      'https://pay.stripe.test/receipt/abc',
    )
    expect(await screen.findByRole('button', { name: /Copied/i })).toBeTruthy()
  })

  it('falls back to the legacy copy when the clipboard API is blocked', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true,
    })
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })

    render(<DonationDetailModal donation={{ kind: 'off', row: offRow }} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Copy invoice URL/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/i })).toBeTruthy())
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('reports a failure when neither clipboard path works', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('blocked')) },
      configurable: true,
    })
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
    })

    render(<DonationDetailModal donation={{ kind: 'off', row: offRow }} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Copy invoice URL/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Copy failed/i })).toBeTruthy())
  })

  it('disables the copy button when the row has no invoice URL', () => {
    render(<DonationDetailModal donation={{ kind: 'off', row: guestRow }} onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('renders the recurring variant with a Monthly badge and Donation Status label', () => {
    render(
      <DonationDetailModal donation={{ kind: 'recurring', row: recurringRow }} onClose={vi.fn()} />,
    )

    expect(screen.getByText('Recurring donation.')).toBeTruthy()
    expect(screen.getByText('Monthly')).toBeTruthy()
    expect(screen.getByText('Donation Status')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Copy invoice URL/i })).toHaveProperty(
      'disabled',
      false,
    )
  })
})
