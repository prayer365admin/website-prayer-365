import { describe, expect, it } from 'vitest'
import { isHttpsLink, normalizeLink } from './link'

describe('link utils', () => {
  it('adds https when the scheme is missing and keeps explicit schemes', () => {
    expect(normalizeLink(' example.org/r ')).toBe('https://example.org/r')
    expect(normalizeLink('http://example.org')).toBe('http://example.org')
    expect(normalizeLink('   ')).toBeNull()
    expect(normalizeLink(undefined)).toBeNull()
  })

  it('accepts only https links with a dotted host', () => {
    expect(isHttpsLink('https://example.org/r')).toBe(true)
    expect(isHttpsLink('http://example.org')).toBe(false)
    expect(isHttpsLink('javascript:alert(1)')).toBe(false)
    expect(isHttpsLink('https://localhost')).toBe(false)
  })
})
