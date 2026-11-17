// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from './proxy'

const DONATE = 'http://localhost:3000/donate'

const request = (cookie?: string) =>
  new NextRequest(DONATE, cookie ? { headers: { cookie } } : undefined)

describe('proxy — /donate branches on the session', () => {
  it('sends a visitor without a session to public giving', () => {
    const res = proxy(request())

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/give')
  })

  it('lets a session reach the church portal', () => {
    const res = proxy(request('authjs.session-token=abc'))

    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('accepts the https session cookie variant', () => {
    const res = proxy(request('__Secure-authjs.session-token=abc'))

    expect(res.status).toBe(200)
  })
})
