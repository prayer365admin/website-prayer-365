import { describe, expect, it } from 'vitest'
import { generateRandomString } from './generate-random-string'

describe('generateRandomString', () => {
  it('returns string of requested length', () => {
    expect(generateRandomString()).toHaveLength(6)
    expect(generateRandomString(12)).toHaveLength(12)
  })

  it('only uses alphanumeric characters', () => {
    expect(generateRandomString(50)).toMatch(/^[a-zA-Z0-9]+$/)
  })
})
