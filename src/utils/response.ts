import { NextResponse } from 'next/server'
import { GeneralError } from './general-error'
import { logger } from './logger'

let counter = 0

/** Short, unique trace id attached to every response + log line. */
export const requestId = () =>
  `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const ok = (
  result: unknown,
  message: string,
  status = 200,
  extra?: Record<string, unknown>,
) =>
  NextResponse.json(
    { success: true, message, result, request_id: requestId(), ...extra },
    { status },
  )

export const list = (
  result: unknown[],
  total: number,
  page: number,
  limit: number,
  message: string,
) => ok(result, message, 200, { total, page, limit })

/** Mark a response carrying private data as uncacheable (SPEC §2.2). */
export const noStore = (res: NextResponse) => {
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

export const httpError = (e: unknown) => {
  if (e instanceof GeneralError) {
    const body: Record<string, unknown> = {
      code: e.code,
      error: e.error,
      error_code: e.error_code,
      details: e.details,
      request_id: requestId(),
    }
    if (e.fields) body.fields = e.fields
    return NextResponse.json(body, { status: e.code })
  }
  // 500s: keep one structured trace through the central logger (field name
  // `error_message` — a bare `message` is redacted by utils/logger.ts).
  logger.error({
    event: 'http_error_500',
    error_name: (e as Error)?.name,
    error_message: (e as Error)?.message,
  })
  return NextResponse.json(
    {
      code: 500,
      error: 'INTERNAL_ERROR',
      error_code: 'INTERNAL_ERROR',
      details: 'Something went wrong',
      request_id: requestId(),
    },
    { status: 500 },
  )
}
