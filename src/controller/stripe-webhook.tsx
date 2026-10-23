import { GeneralError } from '@/utils/general-error'
import { logger } from '@/utils/logger'
import {
  verifyStripeWebhookSignature,
  parseStripeWebhookEvent,
  RECORD_STRIPE_WEBHOOK_RECEIPT,
} from '@/providers/stripe-webhook'
import { StripeWebhookResult } from '@/models/stripe-webhook'

export async function handleStripeWebhook({
  rawBody,
  signatureHeader,
  secretOverride,
}: {
  rawBody: string
  signatureHeader: string | null
  secretOverride?: string
}): Promise<StripeWebhookResult> {
  const secret = secretOverride ?? process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    throw new GeneralError({
      code: 500,
      error: 'CONFIGURATION_ERROR',
      error_code: 'STRIPE_WEBHOOK_SECRET_MISSING',
      details: 'Stripe webhook signing secret is not configured.',
    })
  }

  try {
    verifyStripeWebhookSignature({ rawBody, signatureHeader, secret })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('stripe_webhook_signature_mismatch', {
        details: err instanceof Error ? err.message : String(err),
        tip: 'If using stripe listen, copy the signing secret printed by Stripe CLI into .env as STRIPE_WEBHOOK_SECRET and restart the dev server.',
      })
    }
    throw err
  }

  const event = parseStripeWebhookEvent(rawBody)

  const result = await RECORD_STRIPE_WEBHOOK_RECEIPT({ event })

  return result
}
