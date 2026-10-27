import { describe, expect, it } from 'vitest'
import { parseSearchParams } from './parse-search-params'
import { GeneralError } from './general-error'

describe('parseSearchParams', () => {
  it('returns default pagination values', () => {
    const result = parseSearchParams(new URLSearchParams())
    expect(result.order_by).toBe('created_at')
    expect(result.order_direction).toBe('desc')
    expect(result.page).toBeUndefined()
    expect(result.limit).toBeUndefined()
  })

  it('parses numeric page/limit', () => {
    const result = parseSearchParams(new URLSearchParams('page=2&limit=10'))
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
  })

  it('normalizes numeric page/limit and rejects non-finite values', () => {
    const result = parseSearchParams(new URLSearchParams('page=abc&limit=1.5'))
    expect(result.page).toBeUndefined()
    expect(result.limit).toBe(1)
    expect(parseSearchParams(new URLSearchParams('page=Infinity&limit=999')).limit).toBe(100)
  })

  it('throws GeneralError on invalid order_direction', () => {
    expect(() => parseSearchParams(new URLSearchParams('order_direction=sideways'))).toThrowError(
      GeneralError,
    )
    try {
      parseSearchParams(new URLSearchParams('order_direction=sideways'))
    } catch (e) {
      expect(e).toMatchObject({ code: 400, error_code: 'SEARCH_PARAMS_INVALID' })
    }
  })

  it('maps schema tokens to typed values', () => {
    const result = parseSearchParams(
      new URLSearchParams('refund_type=full&is_active=true&count=7'),
      {
        refund_type: String,
        is_active: Boolean,
        count: Number,
      },
    )
    expect(result.refund_type).toBe('full')
    expect(result.is_active).toBe(true)
    expect(result.count).toBe(7)
  })
})
