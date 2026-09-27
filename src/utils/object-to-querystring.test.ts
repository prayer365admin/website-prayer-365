import { describe, expect, it } from 'vitest'
import { objectToQueryString } from './object-to-querystring'

describe('objectToQueryString', () => {
  it('joins key=value pairs with &', () => {
    expect(objectToQueryString({ a: 1, b: 'two' })).toBe('a=1&b=two')
  })

  it('URL-encodes keys and values', () => {
    expect(objectToQueryString({ 'search query': 'a b&c' })).toBe('search%20query=a%20b%26c')
  })
})
