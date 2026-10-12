import { z } from 'zod'

export const StripeWebhookEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  account: z.string().optional(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
  created: z.number().optional(),
})

export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventSchema>

export type ParsedWebhookEvent = StripeWebhookEvent & {
  objectId: string
}

export const StripeWebhookResultSchema = z.object({
  received: z.boolean(),
  duplicate: z.boolean(),
  ignored: z.boolean().optional(),
  receiptId: z.string().optional(),
  jobId: z.string().optional(),
})

export type StripeWebhookResult = z.infer<typeof StripeWebhookResultSchema>
