import { expect, test, describe, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { GeneralError } from '@/utils/general-error'

const mockHandle = vi.hoisted(() => vi.fn())

vi.mock('@/controller/stripe-webhook', () => ({
  handleStripeWebhook: mockHandle,
}))

describe('POST /api/v1/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createRequest = (body: string, signature: string | null) => {
    const headers = new Headers()
    if (signature !== null) {
      headers.set('stripe-signature', signature)
    }
    return new NextRequest('http://localhost/api/v1/webhooks/stripe', {
      method: 'POST',
      headers,
      body,
    })
  }

  test('POST with valid signature returns 200 success', async () => {
    mockHandle.mockResolvedValue({ received: true, duplicate: false, receiptId: 'wr_1' })
    const req = createRequest('{"id":"evt_1"}', 't=123,v1=sig')

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
      success: true,
      result: { received: true, duplicate: false, receiptId: 'wr_1' },
      message: 'Webhook received.',
    })
  })

  test('POST with invalid signature returns 400 INVALID_SIGNATURE', async () => {
    mockHandle.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'test',
      }),
    )
    const req = createRequest('{"id":"evt_1"}', 'bad_sig')

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toMatchObject({
      code: 400,
      error: 'BAD_REQUEST',
      error_code: 'INVALID_SIGNATURE',
    })
  })

  test('POST with missing signature header returns 400', async () => {
    mockHandle.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_SIGNATURE',
        details: 'test',
      }),
    )
    const req = createRequest('{"id":"evt_1"}', null)

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('POST with malformed JSON body returns 400', async () => {
    mockHandle.mockRejectedValue(
      new GeneralError({
        code: 400,
        error: 'BAD_REQUEST',
        error_code: 'INVALID_PAYLOAD',
        details: 'test',
      }),
    )
    const req = createRequest('bad json', 'sig')

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('POST for unknown account returns 200', async () => {
    mockHandle.mockResolvedValue({ received: true, duplicate: false, ignored: true })
    const req = createRequest('{"id":"evt_1"}', 'sig')

    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  test('POST for duplicate event returns 200', async () => {
    mockHandle.mockResolvedValue({ received: true, duplicate: true })
    const req = createRequest('{"id":"evt_1"}', 'sig')

    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
