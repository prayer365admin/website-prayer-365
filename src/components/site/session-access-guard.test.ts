import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'
import { getSessionRedirect } from './session-access-guard'

const session = (role: Session['user']['role']): Session => ({ user: { role } }) as Session

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
