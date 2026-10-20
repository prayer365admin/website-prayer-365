import { render, waitFor } from '@testing-library/react'
import type { Session } from 'next-auth'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SessionAccessGuard, { getSessionRedirect } from './session-access-guard'

const { getSessionMock, useSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  useSessionMock: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  getSession: () => getSessionMock(),
  useSession: () => useSessionMock(),
}))

const session = (role: Session['user']['role']): Session => ({ user: { role } }) as Session

/** jsdom has no PageTransitionEvent constructor in every version. */
const pageShow = (persisted: boolean) => {
  const event = new Event('pageshow')
  Object.defineProperty(event, 'persisted', { value: persisted })
  window.dispatchEvent(event)
}

describe('getSessionRedirect', () => {
  it('sends guests away from protected customer pages', () => {
    expect(getSessionRedirect('protected', null)).toBe('/login')
    expect(getSessionRedirect('protected', session(null))).toBeNull()
  })

  it('sends authenticated customers away from guest pages', () => {
    expect(getSessionRedirect('guest', session(null))).toBe('/customer')
    expect(getSessionRedirect('guest', session({ id: 'r1', name: 'prayer_user' }))).toBe(
      '/customer',
    )
    expect(getSessionRedirect('guest', session({ id: 'r2', name: 'administrator' }))).toBeNull()
    expect(getSessionRedirect('guest', null)).toBeNull()
  })
})

describe('SessionAccessGuard', () => {
  afterEach(() => {
    document.documentElement.style.visibility = ''
    getSessionMock.mockReset()
    useSessionMock.mockReset()
  })

  it('leaves normal page loads to the server guard, even when the client session disagrees', () => {
    useSessionMock.mockReturnValue({ data: session(null), status: 'authenticated' })
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })

    render(<SessionAccessGuard access="guest" />)

    expect(replace).not.toHaveBeenCalled()
    expect(document.documentElement.style.visibility).not.toBe('hidden')
    vi.unstubAllGlobals()
  })

  it('reveals the page when the session check fails after a back/forward-cache restore', async () => {
    useSessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    getSessionMock.mockRejectedValue(new Error('offline'))

    render(<SessionAccessGuard access="protected" />)

    window.dispatchEvent(new Event('pagehide'))
    expect(document.documentElement.style.visibility).toBe('hidden')

    pageShow(true)
    await waitFor(() => expect(document.documentElement.style.visibility).not.toBe('hidden'))
  })

  it('keeps the page hidden when the restored session is gone', async () => {
    useSessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    getSessionMock.mockResolvedValue(null)
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })

    render(<SessionAccessGuard access="protected" />)
    window.dispatchEvent(new Event('pagehide'))
    pageShow(true)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(document.documentElement.style.visibility).toBe('hidden')

    vi.unstubAllGlobals()
  })
})
