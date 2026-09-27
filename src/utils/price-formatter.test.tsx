import { describe, expect, it } from 'vitest'
import priceFormatter from './price-formatter'

describe('priceFormatter', () => {
  it('formats number with 2 decimals + thousands separators', () => {
    expect(priceFormatter({ value: 1234.5 })).toBe('1,234.50')
  })

  it('accepts string input', () => {
    expect(priceFormatter({ value: '99.9' })).toBe('99.90')
  })
})
