import { z } from 'zod'
import { GeneralError } from '@/utils/general-error'

/*
 * Runtime validation (SPEC §2.1 / §6.1). Schemas live in `models/`; routes
 * call `validate(schema, body)` which returns typed data or throws a 422
 * GeneralError with per-field messages. Assumes Zod v4.
 */

export const validate = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const parsed = schema.safeParse(data)
  if (parsed.success) return parsed.data
  return rejectZod(parsed.error)
}

export const rejectZod = (error: z.ZodError): never => {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'body'
    if (!fields[key]) fields[key] = issue.message
  }
  const first = error.issues[0]?.message ?? 'Validation failed.'
  throw new GeneralError({
    code: 422,
    error: 'VALIDATION_ERROR',
    error_code: 'VALIDATION_ERROR',
    details: first,
    fields,
  })
}
