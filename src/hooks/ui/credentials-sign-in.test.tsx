import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCredentialsSignIn } from './credentials-sign-in'

const m = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  hardNavigate: vi.fn(),
}))

vi.mock('next-auth/react', () => ({ signIn: m.signIn }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push }) }))
vi.mock('@/utils/hard-navigate', () => ({ hardNavigate: m.hardNavigate }))

/*
 * Sign-in navigation contract (plan 025): success ends in a FULL page load, so
 * the client router cache collected before the session existed cannot be
 * replayed (a guest visit of a protected page stays cached as its `/login`
 * redirect, which stranded the customer on the profile page until a reload).
 */
describe('useCredentialsSignIn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads the document at the target after a successful sign-in (no client navigation)', async () => {
    m.signIn.mockResolvedValue({ error: undefined, code: undefined })
    const { result } = renderHook(() => useCredentialsSignIn('/'))

    await expect(
      result.current.onSignIn({ email: 'maria@example.com', password: 'Secret@123' }),
    ).resolves.toBeNull()

    expect(m.hardNavigate).toHaveBeenCalledTimes(1)
    expect(m.hardNavigate).toHaveBeenCalledWith('/')
    expect(m.push).not.toHaveBeenCalled()
    expect(m.signIn).toHaveBeenCalledWith('credentials', {
      name: 'maria@example.com',
      password: 'Secret@123',
      redirect: false,
    })
  })

  it('resolves a function target before navigating (setup progress)', async () => {
    m.signIn.mockResolvedValue({ error: undefined })
    const resolveTarget = vi.fn().mockResolvedValue('/customer/setup')
    const { result } = renderHook(() => useCredentialsSignIn(resolveTarget))

    await result.current.onSignIn({ email: 'maria@example.com', password: 'Secret@123' })

    expect(resolveTarget).toHaveBeenCalledTimes(1)
    expect(m.hardNavigate).toHaveBeenCalledWith('/customer/setup')
  })

  it('keeps the verify-email step a client navigation (no session change to pick up)', async () => {
    m.signIn.mockResolvedValue({ error: 'x', code: 'EMAIL_NOT_VERIFIED' })
    const { result } = renderHook(() => useCredentialsSignIn('/'))

    await expect(
      result.current.onSignIn({ email: 'maria@example.com', password: 'Secret@123' }),
    ).resolves.toBeNull()

    expect(m.push).toHaveBeenCalledWith('/verify-account?email=maria%40example.com')
    expect(m.hardNavigate).not.toHaveBeenCalled()
  })

  it('returns the error code and navigates nowhere on invalid credentials', async () => {
    m.signIn.mockResolvedValue({ error: 'x', code: 'INVALID_CREDENTIALS' })
    const { result } = renderHook(() => useCredentialsSignIn('/'))

    await expect(
      result.current.onSignIn({ email: 'maria@example.com', password: 'Secret@123' }),
    ).resolves.toBe('INVALID_CREDENTIALS')

    expect(m.hardNavigate).not.toHaveBeenCalled()
    expect(m.push).not.toHaveBeenCalled()
  })

  it('falls back to SIGN_IN_FAILED when NextAuth returns no code', async () => {
    m.signIn.mockResolvedValue({ error: 'Configuration', code: undefined })
    const { result } = renderHook(() => useCredentialsSignIn('/'))

    await expect(
      result.current.onSignIn({ email: 'maria@example.com', password: 'Secret@123' }),
    ).resolves.toBe('SIGN_IN_FAILED')

    expect(m.hardNavigate).not.toHaveBeenCalled()
  })
})
