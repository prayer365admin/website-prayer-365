import { describe, expect, it } from 'vitest'
import { GeneralError } from './general-error'
import { httpError, list, noStore, ok, requestId } from './response'

const toBody = async (res: Response) => res.json()

describe('requestId', () => {
  it('returns a short unique string', () => {
    const a = requestId()
    const b = requestId()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThan(0)
  })
})

describe('ok', () => {
  it('returns success envelope with result, message, request_id', async () => {
    const res = ok({ id: 'x' }, 'Saved', 201)
    expect(res.status).toBe(201)
    const body = await toBody(res)
    expect(body.success).toBe(true)
    expect(body.message).toBe('Saved')
    expect(body.result).toEqual({ id: 'x' })
    expect(typeof body.request_id).toBe('string')
  })

  it('includes extra fields', async () => {
    const res = ok({ id: 'x' }, 'ok', 200, { total: 5, page: 1, limit: 25 })
    const body = await toBody(res)
    expect(body.total).toBe(5)
    expect(body.page).toBe(1)
  })
})

describe('list', () => {
  it('returns paginated envelope with total/page/limit', async () => {
    const res = list([{ id: 1 }], 40, 2, 25, 'Loaded')
    expect(res.status).toBe(200)
    const body = await toBody(res)
    expect(body.result).toEqual([{ id: 1 }])
    expect(body.total).toBe(40)
    expect(body.page).toBe(2)
    expect(body.limit).toBe(25)
  })
})

describe('httpError', () => {
  it('maps GeneralError to its status with all fields', async () => {
    const err = new GeneralError({
      code: 422,
      error: 'VALIDATION_ERROR',
      error_code: 'PRAYER_TITLE_REQUIRED',
      details: 'Please provide a title.',
      fields: { title: 'Required' },
    })
    const res = httpError(err)
    expect(res.status).toBe(422)
    const body = await toBody(res)
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.error_code).toBe('PRAYER_TITLE_REQUIRED')
    expect(body.fields).toEqual({ title: 'Required' })
    expect(typeof body.request_id).toBe('string')
  })

  it('omits fields when absent', async () => {
    const err = new GeneralError({
      code: 401,
      error: 'UNAUTHORIZED',
      error_code: 'UNAUTHORIZED',
      details: 'nope',
    })
    const body = await toBody(httpError(err))
    expect(body.fields).toBeUndefined()
  })

  it('maps unknown error to generic 500 without leaking message/stack', async () => {
    const res = httpError(new Error('secret db row password=abc'))
    expect(res.status).toBe(500)
    const body = await toBody(res)
    expect(body.details).toBe('Something went wrong')
    expect(JSON.stringify(body)).not.toContain('secret db row')
    expect(body.error_code).toBe('INTERNAL_ERROR')
  })

  it('leaves known GeneralError instances untouched (no re-wrap)', async () => {
    const err = new GeneralError({
      code: 409,
      error: 'CONFLICT',
      error_code: 'STALE_VERSION',
      details: 'stale',
    })
    expect(httpError(err).status).toBe(409)
  })
})

describe('noStore', () => {
  it('sets Cache-Control: private, no-store and keeps the body', async () => {
    const res = noStore(ok({ id: 'x' }, 'ok'))
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await toBody(res)).result).toEqual({ id: 'x' })
  })
})
