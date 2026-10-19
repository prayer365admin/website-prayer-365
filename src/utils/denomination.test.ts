import { describe, expect, it } from 'vitest'
import { formatDenomination } from './denomination'

describe('formatDenomination', () => {
  it('extracts acronym or text inside parentheses when present', () => {
    expect(formatDenomination('Lutheran (EELK)')).toBe('EELK')
    expect(formatDenomination('Baptist (EEKBKL)')).toBe('EEKBKL')
    expect(formatDenomination('Orthodox (EAÕK)')).toBe('EAÕK')
    expect(formatDenomination('Lutheran ( EELK )')).toBe('EELK')
  })

  it('falls back to original trimmed denomination when no parentheses are present', () => {
    expect(formatDenomination('Lutheran')).toBe('Lutheran')
    expect(formatDenomination('Catholic')).toBe('Catholic')
    expect(formatDenomination('  Baptist  ')).toBe('Baptist')
  })

  it('returns null for null, undefined, or blank values', () => {
    expect(formatDenomination(null)).toBeNull()
    expect(formatDenomination(undefined)).toBeNull()
    expect(formatDenomination('')).toBeNull()
    expect(formatDenomination('   ')).toBeNull()
  })
})
