import { describe, expect, it } from 'vitest'
import { dialHref } from './support-hotline'

describe('dialHref', () => {
  it('strips the spacing a displayed number carries', () => {
    expect(dialHref('+372 644 1483')).toBe('tel:+3726441483')
    expect(dialHref('+372 (0) 644-1483')).toBe('tel:+37206441483')
  })

  it('keeps a leading plus and drops anything else', () => {
    expect(dialHref('372 644 1483')).toBe('tel:3726441483')
  })
})
