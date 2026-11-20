-- The donation detail modal offers "Copy invoice URL", so the ledger keeps the
-- provider's hosted receipt URL alongside the payment. Nullable with no
-- backfill: existing (and FAILED) rows have no invoice and the UI shows "—"
-- until a later payment-sync event writes one.
ALTER TABLE "donations" ADD COLUMN "invoice_url" TEXT;
