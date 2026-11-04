// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/utils/required-auth', () => ({ default: vi.fn() }))
vi.mock('@/controller/mobile', () => ({
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
  registerDevice: vi.fn(),
  revokeDevice: vi.fn(),
}))

import requiredAuth from '@/utils/required-auth'
import {
  getNotificationPreferences,
  registerDevice,
  revokeDevice,
  saveNotificationPreferences,
} from '@/controller/mobile'
import { GET, PUT } from './me/notification-preferences/route'
import { DELETE, PUT as PUT_DEVICE } from './me/devices/[installationId]/route'

const prefs = {
  dailyPrayer: true,
  sundayService: true,
  churchEvents: true,
  announcements: true,
  platformInformation: true,
  donationReminder: true,
}
const params = { params: Promise.resolve({ installationId: 'install-1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requiredAuth).mockResolvedValue({
    session: { user: { user_id: 'u1' } },
  } as never)
  vi.mocked(getNotificationPreferences).mockResolvedValue(prefs)
  vi.mocked(saveNotificationPreferences).mockResolvedValue(prefs)
  vi.mocked(registerDevice).mockResolvedValue({
    installationId: 'install-1',
    platform: 'ios',
    provider: 'fcm',
    updatedAt: '2026-10-30T10:00:00.000Z',
  })
  vi.mocked(revokeDevice).mockResolvedValue({ revoked: 1 })
})

describe('notification-preferences route', () => {
  it('GET returns the caller preferences', async () => {
    const res = await GET(new NextRequest('http://x/api/v1/mobile/me/notification-preferences'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, result: prefs })
  })

  it('PUT saves all six keys', async () => {
    const req = new NextRequest('http://x/api/v1/mobile/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    })
    const res = await PUT(req)
    expect(res.status).toBe(200)
    expect(saveNotificationPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', input: prefs }),
    )
  })

  it('PUT rejects an unknown key with 422', async () => {
    const req = new NextRequest('http://x/api/v1/mobile/me/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ ...prefs, extra: true }),
    })
    const res = await PUT(req)
    expect(res.status).toBe(422)
  })
})

describe('devices route', () => {
  const body = { platform: 'ios', provider: 'fcm', token: 'fcm-token-1234567890' }

  it('PUT registers the installation', async () => {
    const req = new NextRequest('http://x/api/v1/mobile/me/devices/install-1', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    const res = await PUT_DEVICE(req, params)
    expect(res.status).toBe(200)
    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', installationId: 'install-1', input: body }),
    )
  })

  it('PUT rejects a non-FCM provider', async () => {
    const req = new NextRequest('http://x/api/v1/mobile/me/devices/install-1', {
      method: 'PUT',
      body: JSON.stringify({ ...body, provider: 'expo' }),
    })
    const res = await PUT_DEVICE(req, params)
    expect(res.status).toBe(422)
  })

  it('DELETE revokes and answers 204', async () => {
    const res = await DELETE(
      new NextRequest('http://x/api/v1/mobile/me/devices/install-1', { method: 'DELETE' }),
      params,
    )
    expect(res.status).toBe(204)
    expect(revokeDevice).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', installationId: 'install-1' }),
    )
  })
})
