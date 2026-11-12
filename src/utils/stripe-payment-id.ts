/** A Stripe reference is either the id string or the expanded object. */
const providerRefId = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value || undefined
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = value.id
    if (typeof id === 'string' && id) return id
  }
  return undefined
}

/**
 * The invoice's money movement, resolved identically by every ledger writer so
 * one gift can only ever land as one `donations` row.
 *
 * `CheckoutSession.payment_intent` is populated only for `payment` mode, so a
 * monthly session carries none, and API 2025-03-31 removed the top-level
 * `Invoice.payment_intent` in favour of `Invoice.payments[].payment.payment_intent`.
 * Reading only the legacy fields made the redirect page write a `cs_…` row and
 * `invoice.payment_succeeded` write an `in_…` row for the same payment.
 *
 * Falls back to the invoice id only when the caller allows it, so a LEDGER WRITER can opt
 * out and leave the row to the webhook retry instead of splitting one gift into two rows.
 */
export function RESOLVE_INVOICE_PAYMENT_ID(
  invoice: unknown,
  options: { invoiceIdFallback?: boolean } = {},
): string | undefined {
  if (typeof invoice !== 'object' || invoice === null) return undefined

  const direct = 'payment_intent' in invoice ? providerRefId(invoice.payment_intent) : undefined
  if (direct) return direct

  const payments = 'payments' in invoice ? invoice.payments : undefined
  const entries =
    typeof payments === 'object' && payments !== null && 'data' in payments
      ? payments.data
      : undefined
  let unpaidFallback: string | undefined
  if (Array.isArray(entries)) {
    // A retried invoice can hold several payments; the settled one owns the row.
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null || !('payment' in entry)) continue
      const payment = entry.payment
      if (typeof payment !== 'object' || payment === null || !('payment_intent' in payment)) {
        continue
      }
      const paymentIntent = providerRefId(payment.payment_intent)
      if (!paymentIntent) continue
      if ('status' in entry && entry.status === 'paid') return paymentIntent
      unpaidFallback ??= paymentIntent
    }
  }
  if (unpaidFallback) return unpaidFallback

  // Pre-PaymentIntent invoices (and payment_record settlements) only carry a charge.
  if ('charge' in invoice && typeof invoice.charge === 'object' && invoice.charge !== null) {
    const charge = invoice.charge
    if ('payment_intent' in charge) {
      const chargePaymentIntent = providerRefId(charge.payment_intent)
      if (chargePaymentIntent) return chargePaymentIntent
    }
  }

  // A caller that writes a ledger row must NOT fall back to the invoice id: the webhook
  // would key the same gift on `pi_…` and split it into two rows.
  if (options.invoiceIdFallback === false) return undefined
  return 'id' in invoice ? providerRefId(invoice.id) : undefined
}
