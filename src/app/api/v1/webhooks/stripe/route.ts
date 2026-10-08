import { NextRequest } from 'next/server'
import { handleStripeWebhook } from '@/controller/stripe-webhook'
import { ok, httpError } from '@/utils/response'
import { registerPath } from '@/utils/openapi'

registerPath({
  path: '/webhooks/stripe',
  method: 'post',
  auth: false,
  summary: 'Stripe webhook endpoint for payment and subscription event ingestion',
  responses: [
    { status: 200, description: 'Webhook received' },
    { status: 400, description: 'Invalid signature or payload' },
    { status: 500, description: 'Configuration error' },
  ],
})

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signatureHeader = req.headers.get('stripe-signature')

    const result = await handleStripeWebhook({ rawBody, signatureHeader })

    return ok(result, 'Webhook received.')
  } catch (e) {
    return httpError(e)
  }
}
