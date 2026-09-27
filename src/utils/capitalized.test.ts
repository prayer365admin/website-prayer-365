import { describe, expect, it } from 'vitest'
import { toCapitalized } from './capitalized'

describe('toCapitalized', () => {
  it('splits kebab/snake and capitalizes words', () => {
    expect(toCapitalized('user-management')).toBe('User Management')
    expect(toCapitalized('first_name')).toBe('First Name')
  })
})
