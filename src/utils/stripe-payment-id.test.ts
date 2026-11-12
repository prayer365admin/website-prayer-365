// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { RESOLVE_INVOICE_PAYMENT_ID } from './stripe-payment-id'

describe('RESOLVE_INVOICE_PAYMENT_ID — one ledger key per payment', () => {
  it('reads the settled invoice payment, ignoring an unpaid retry', () => {
    expect(
      RESOLVE_INVOICE_PAYMENT_ID({
        id: 'in_1',
        payments: {
          data: [
            { id: 'inpay_open', status: 'open', payment: { payment_intent: 'pi_open' } },
            { id: 'inpay_paid', status: 'paid', payment: { payment_intent: 'pi_paid' } },
          ],
        },
      }),
    ).toBe('pi_paid')
  })

  it('accepts an expanded payment intent object', () => {
    expect(
      RESOLVE_INVOICE_PAYMENT_ID({
        id: 'in_1',
        payments: { data: [{ status: 'paid', payment: { payment_intent: { id: 'pi_obj' } } }] },
      }),
    ).toBe('pi_obj')
  })

  it('falls back to an unpaid payment when nothing settled yet', () => {
    expect(
      RESOLVE_INVOICE_PAYMENT_ID({
        id: 'in_1',
        payments: { data: [{ status: 'open', payment: { payment_intent: 'pi_open' } }] },
      }),
    ).toBe('pi_open')
  })

  it('honours the legacy top-level payment_intent field', () => {
    expect(RESOLVE_INVOICE_PAYMENT_ID({ id: 'in_1', payment_intent: 'pi_legacy' })).toBe(
      'pi_legacy',
    )
  })

  it('uses the charge when the invoice carries no payment intent', () => {
    expect(
      RESOLVE_INVOICE_PAYMENT_ID({ id: 'in_1', charge: { payment_intent: 'pi_charge' } }),
    ).toBe('pi_charge')
  })

  it('falls back to the invoice id so every writer agrees', () => {
    expect(RESOLVE_INVOICE_PAYMENT_ID({ id: 'in_only' })).toBe('in_only')
  })

  it('resolves nothing for a missing or non-object payload', () => {
    expect(RESOLVE_INVOICE_PAYMENT_ID(null)).toBeUndefined()
    expect(RESOLVE_INVOICE_PAYMENT_ID(undefined)).toBeUndefined()
    expect(RESOLVE_INVOICE_PAYMENT_ID('in_1')).toBeUndefined()
  })
})
