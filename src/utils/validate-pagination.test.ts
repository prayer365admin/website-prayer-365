import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validate, rejectZod } from './validate'
import { parseListQuery } from './pagination'

describe('validate', () => {
  const schema = z.object({ title: z.string().min(1), body: z.string().min(1) })

  it('returns typed data on success', () => {
    expect(validate(schema, { title: 'A', body: 'B' })).toEqual({ title: 'A', body: 'B' })
  })

  it('throws 422 with per-field map on failure', () => {
    try {
      validate(schema, { title: '', body: 5 })
      throw new Error('should have thrown')
    } catch (e) {
      const err = e as { code: number; error_code: string; fields: Record<string, string> }
      expect(err.code).toBe(422)
      expect(err.error_code).toBe('VALIDATION_ERROR')
      expect(err.fields).toHaveProperty('title')
      expect(err.fields).toHaveProperty('body')
    }
  })

  it('handles nested paths', () => {
    const nested = z.object({ a: z.object({ b: z.string().min(2) }) })
    try {
      validate(nested, { a: { b: 'x' } })
    } catch (e) {
      expect((e as { fields: Record<string, string> }).fields['a.b']).toBeDefined()
    }
  })
})

describe('rejectZod', () => {
  it('throws never with a GeneralError-compatible shape', () => {
    const err = z.object({ x: z.string() }).safeParse({ x: 1 })
    if (err.success) throw new Error('expected failure')
    const thrown = () => rejectZod(err.error)
    try {
      thrown()
    } catch (e) {
      expect((e as { code: number }).code).toBe(422)
    }
  })
})

describe('parseListQuery', () => {
  const allow = { allowOrderBy: ['created_at', 'title', 'id'] }

  it('applies defaults page=1 limit=25', () => {
    expect(parseListQuery(new URLSearchParams(''), allow)).toMatchObject({
      page: 1,
      limit: 25,
      order_by: 'created_at',
      order_direction: 'desc',
    })
  })

  it('clamps limit to 100 max and page >= 1', () => {
    expect(parseListQuery(new URLSearchParams('page=0&limit=999'), allow)).toMatchObject({
      page: 1,
      limit: 100,
    })
    expect(parseListQuery(new URLSearchParams('page=-5&limit=0'), allow)).toMatchObject({
      page: 1,
      limit: 1,
    })
    expect(
      parseListQuery(new URLSearchParams('page=999999999999&limit=Infinity'), allow),
    ).toMatchObject({
      page: 999999999999,
      limit: 25,
    })
  })

  it('rejects a non-allowlisted order_by', () => {
    let caught: { error_code: string } | null = null
    try {
      parseListQuery(new URLSearchParams('order_by=secret_col'), allow)
    } catch (e) {
      caught = e as { error_code: string }
    }
    expect(caught?.error_code).toBe('INVALID_ORDER_BY')
  })

  it('rejects invalid order_direction', () => {
    let caught: { error_code: string } | null = null
    try {
      parseListQuery(new URLSearchParams('order_direction=UP'), allow)
    } catch (e) {
      caught = e as { error_code: string }
    }
    expect(caught?.error_code).toBe('INVALID_ORDER_DIRECTION')
  })

  it('reads search and valid order_by', () => {
    expect(
      parseListQuery(new URLSearchParams('search=joy&order_by=title&order_direction=asc'), allow),
    ).toMatchObject({
      search: 'joy',
      order_by: 'title',
      order_direction: 'asc',
    })
  })
})
