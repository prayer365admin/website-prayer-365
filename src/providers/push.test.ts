import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendEachForMulticast = vi.hoisted(() => vi.fn())

vi.mock('firebase-admin/app', () => ({
  cert: vi.fn((x) => x),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(() => ({ name: 'test' })),
}))
vi.mock('firebase-admin/messaging', () => ({
  getMessaging: vi.fn(() => ({ sendEachForMulticast })),
}))

import { SEND_PUSH_BATCH } from './push'

const message = (token: string) => ({
  token,
  title: 'New prayer',
  body: 'A prayer',
  data: { type: 'prayer', resourceId: 'p1', churchId: 'c1', messageId: 'm1' },
})

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'test' })
})

describe('FCM transport', () => {
  it('maps success and invalid-token outcomes per token', async () => {
    sendEachForMulticast.mockResolvedValue({
      responses: [
        { success: true, messageId: 'm-ok' },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
        { success: false, error: { code: 'messaging/internal-error' } },
      ],
    })

    const result = await SEND_PUSH_BATCH([message('t1'), message('t2'), message('t3')])

    expect(result).toEqual([
      { token: 't1', ok: true, messageId: 'm-ok', errorCode: undefined, invalidToken: false },
      {
        token: 't2',
        ok: false,
        messageId: undefined,
        errorCode: 'messaging/registration-token-not-registered',
        invalidToken: true,
      },
      {
        token: 't3',
        ok: false,
        messageId: undefined,
        errorCode: 'messaging/internal-error',
        invalidToken: false,
      },
    ])
  })

  it('sends one notification + data payload', async () => {
    sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }] })
    await SEND_PUSH_BATCH([message('t1')])
    expect(sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['t1'],
        notification: { title: 'New prayer', body: 'A prayer' },
        data: expect.objectContaining({ type: 'prayer', churchId: 'c1' }),
      }),
    )
  })

  it('returns early for an empty batch', async () => {
    await expect(SEND_PUSH_BATCH([])).resolves.toEqual([])
    expect(sendEachForMulticast).not.toHaveBeenCalled()
  })

  it('refuses a batch over 500 tokens', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) => message(`t${i}`))
    await expect(SEND_PUSH_BATCH(tooMany)).rejects.toThrow('Push batch exceeds 500 tokens')
  })

  it('fails loudly without the service account', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT
    vi.resetModules()
    const fresh = await import('./push')
    await expect(fresh.SEND_PUSH_BATCH([message('t1')])).rejects.toMatchObject({
      error_code: 'FIREBASE_SERVICE_ACCOUNT_MISSING',
    })
  })
})
