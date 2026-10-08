import { z } from 'zod'

/*
 * Sensitive request DTOs (Task 28 / SPEC §8.2, §9.5). Read-only: no status,
 * assignment, or booking endpoints (D3). Private rows require an explicit
 * church-scoped `prayer_private_request:read` grant; the private filter is
 * applied BEFORE count and pagination so hidden rows never leak totals.
 * Pastoral/meeting rows are always restricted (F7RQ R2): they need the same
 * private grant regardless of classification.
 */

export const REQUEST_KINDS = ['prayer', 'pastoral', 'meeting'] as const

/**
 * Optional `kind` query: one kind or a comma list (`pastoral,meeting` backs the
 * S10 "Pastoral / Meeting" tab). Every value must be in the allowlist.
 */
export const RequestKindsQuerySchema = z.preprocess(
  (v) => (typeof v === 'string' ? v.split(',').map((k) => k.trim()) : v),
  z.array(z.enum(REQUEST_KINDS)).min(1).optional(),
)

/** OpenAPI shape of the raw `kind` query param. */
export const RequestKindsParamSchema = z
  .string()
  .describe('One kind or a comma list of: prayer, pastoral, meeting')
  .optional()

/**
 * Optional list filters besides `kind`. `search` matches the subject only
 * (never the message). `classification` is a label filter,
 * not a workflow status (D3): `standard` means "not PRIVATE". The received
 * range bounds `created_at` (ISO instants with offset).
 */
export const RequestListFilterSchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    classification: z.enum(['private', 'standard']).optional(),
    received_from: z.iso.datetime({ offset: true }).optional(),
    received_to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((f) => !f.received_from || !f.received_to || f.received_from <= f.received_to, {
    message: "'received_from' must not be after 'received_to'.",
    path: ['received_to'],
  })

export type RequestListFilter = z.infer<typeof RequestListFilterSchema>

/** Authorized list item (summary — no message/contact PII). */
export const RequestListSummarySchema = z.object({
  id: z.string(),
  kind: z.string(),
  subject: z.string().nullable(),
  classification: z.string().nullable(),
  contactMethod: z.string(),
  createdAt: z.string(),
})

export type RequestListSummary = z.infer<typeof RequestListSummarySchema>

/** Authorized detail (full fields; handler supplies follow-up via contacts). */
export const RequestOutputSchema = z.object({
  id: z.string(),
  kind: z.string(),
  subject: z.string().nullable(),
  message: z.string(),
  classification: z.string().nullable(),
  contactMethod: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  availability: z.string().nullable(),
  createdAt: z.string(),
})

export type RequestOutput = z.infer<typeof RequestOutputSchema>
