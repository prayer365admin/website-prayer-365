import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GeneralError } from '@/utils/general-error'

const m = vi.hoisted(() => ({ requiredCustomer: vi.fn(), get: vi.fn(), save: vi.fn() }))

vi.mock('@/utils/required-customer', () => ({ default: m.requiredCustomer }))
vi.mock('@/controller/mobile', () => ({
  getNotificationPreferences: m.get,
  saveNotificationPreferences: m.save,
}))

import { GET, PUT } from './route'

const staff = new GeneralError({
  code: 403,
  error: 'UNAUTHORIZED',
  error_code: 'STAFF_ACCOUNT',
  details: 'Staff accounts use the dashboard, not the customer website.',
})
const noSession = new GeneralError({
  code: 401,
  error: 'Not Authenticated!',
  error_code: 'UNAUTHORIZED',
  details: 'Please login and try again!',
})
const request = (body: unknown) => ({ json: async () => body }) as never
const all = {
  dailyPrayer: true,
  churchPrayer: true,
  churchEvents: true,
  announcements: true,
  donationReminder: true,
}

describe('/api/v1/site/me/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('answers 401 without a website session', async () => {
    m.requiredCustomer.mockRejectedValue(noSession)

    expect((await GET()).status).toBe(401)
  })

  it('answers 403 for a staff session', async () => {
    m.requiredCustomer.mockRejectedValue(staff)

    expect((await GET()).status).toBe(403)
  })

  it('returns the five keys for the session customer', async () => {
    m.requiredCustomer.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
    m.get.mockResolvedValue(all)

    const body = await (await GET()).json()

    expect(m.get).toHaveBeenCalledWith({ userId: 'u1' })
    expect(Object.keys(body.result)).toHaveLength(5)
    expect(body.result.dailyPrayer).toBe(true)
  })

  it('saves the submitted switches for the session customer', async () => {
    const input = { ...all, dailyPrayer: false }
    m.requiredCustomer.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
    m.save.mockResolvedValue(input)

    const res = await PUT(request(input))

    expect(res.status).toBe(200)
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', input }))
  })

  it('answers 422 when a switch is not a boolean', async () => {
    m.requiredCustomer.mockResolvedValue({ session: { user: { user_id: 'u1' } } })

    const res = await PUT(request({ dailyPrayer: 'yes' }))

    expect(res.status).toBe(422)
    expect(m.save).not.toHaveBeenCalled()
  })
})
