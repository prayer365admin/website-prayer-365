import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it } from 'vitest'
import { proxy } from './proxy'

const original = process.env.NEXT_PUBLIC_IS_MAINTENANCE

/** The redirect target the proxy answers with, or null when it lets the request through. */
const target = (path: string) =>
  proxy(new NextRequest(`https://prayer365.test${path}`)).headers.get('location')

describe('maintenance proxy', () => {
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_IS_MAINTENANCE
    else process.env.NEXT_PUBLIC_IS_MAINTENANCE = original
  })

  it('sends every public page to /maintenance while the flag is on', () => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = 'true'

    expect(target('/')).toBe('https://prayer365.test/maintenance')
    expect(target('/prayers?churchId=1')).toBe('https://prayer365.test/maintenance')
    expect(target('/welcome')).toBe('https://prayer365.test/maintenance')
  })

  it('keeps the screen, the staff areas and the dashboard open', () => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = 'true'

    expect(target('/maintenance')).toBeNull()
    expect(target('/admin')).toBeNull()
    expect(target('/admin/users')).toBeNull()
    expect(target('/dashboard')).toBeNull()
    expect(target('/dashboard/central')).toBeNull()
    expect(target('/login')).toBeNull()
  })

  it('keeps the policy pages readable while the switch is on', () => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = 'true'

    // People must be able to read the documents they accepted even while the
    // product is paused, and /terms + /cookies only forward into /privacy.
    expect(target('/privacy')).toBeNull()
    expect(target('/terms')).toBeNull()
    expect(target('/cookies')).toBeNull()
  })

  it('lets everything through while the flag is off', () => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = 'false'

    expect(target('/')).toBeNull()
    expect(target('/welcome')).toBeNull()
  })

  it('only the exact string "true" turns it on', () => {
    for (const value of ['TRUE', '1', 'yes', '']) {
      process.env.NEXT_PUBLIC_IS_MAINTENANCE = value
      expect(target('/')).toBeNull()
    }
  })
})
