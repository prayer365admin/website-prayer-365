// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredAuth: vi.fn(), requestMyDeletion: vi.fn() }))

vi.mock('@/utils/required-auth', () => ({ default: m.requiredAuth }))
vi.mock('@/controller/mobile', () => ({ getMe: vi.fn(), patchMe: vi.fn() }))
vi.mock('@/controller/mobile-deletion', () => ({ requestMyDeletion: m.requestMyDeletion }))

import { DELETE } from './route'

const req = (headers: Record<string, string> = { 'Idempotency-Key': 'k1' }, body?: string) =>
  new NextRequest('http://x/api/v1/mobile/me', { method: 'DELETE', headers, body })

describe('DELETE /api/v1/mobile/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('401 without a bearer token', async () => {
    m.requiredAuth.mockRejectedValue(
      new GeneralError({ code: 401, error: 'x', error_code: 'UNAUTHORIZED', details: 'x' }),
    )
    expect((await DELETE(req()))!.status).toBe(401)
    expect(m.requestMyDeletion).not.toHaveBeenCalled()
  })

  it('202 with the ack; user comes from the session and the key from the header', async () => {
    const ack = { job_id: 'j1', state: 'ACCEPTED', grace_ends_at: '2026-12-03T00:00:00.000Z' }
    m.requestMyDeletion.mockResolvedValue(ack)
    const res = (await DELETE(req()))!
    expect(res.status).toBe(202)
    expect((await res.json()).result).toEqual(ack)
    expect(m.requestMyDeletion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', idempotencyKey: 'k1' }),
    )
  })

  it('passes controller errors through (403 not a customer)', async () => {
    m.requestMyDeletion.mockRejectedValue(
      new GeneralError({
        code: 403,
        error: 'FORBIDDEN',
        error_code: 'DELETION_NOT_ALLOWED',
        details: 'x',
      }),
    )
    const res = (await DELETE(req()))!
    expect(res.status).toBe(403)
    expect((await res.json()).error_code).toBe('DELETION_NOT_ALLOWED')
  })

  describe('reason body', () => {
    const ack = { job_id: 'j1', state: 'ACCEPTED', grace_ends_at: '2026-12-03T00:00:00.000Z' }
    beforeEach(() => m.requestMyDeletion.mockResolvedValue(ack))

    it('no body: the request still works and carries no reason', async () => {
      expect((await DELETE(req()))!.status).toBe(202)
      expect(m.requestMyDeletion.mock.calls[0][0].reason).toBeUndefined()
    })

    it('passes a text reason through to the controller', async () => {
      const res = (await DELETE(req(undefined, JSON.stringify({ reason: 'Switching church' }))))!
      expect(res.status).toBe(202)
      expect(m.requestMyDeletion.mock.calls[0][0].reason).toBe('Switching church')
    })

    it('422 when the reason is longer than 500 characters', async () => {
      const res = (await DELETE(req(undefined, JSON.stringify({ reason: 'x'.repeat(501) }))))!
      expect(res.status).toBe(422)
      expect(m.requestMyDeletion).not.toHaveBeenCalled()
    })

    it('422 for an unknown field (strict body)', async () => {
      const res = (await DELETE(
        req(undefined, JSON.stringify({ reason: 'a', userId: 'someone-else' })),
      ))!
      expect(res.status).toBe(422)
      expect(m.requestMyDeletion).not.toHaveBeenCalled()
    })

    it('400 when the body is not JSON', async () => {
      const res = (await DELETE(req(undefined, 'not json')))!
      expect(res.status).toBe(400)
      expect((await res.json()).error_code).toBe('INVALID_JSON')
    })
  })
})
