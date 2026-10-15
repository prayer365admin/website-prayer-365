import { describe, expect, it } from 'vitest'
import { isCustomerRole } from './customer-role'

describe('isCustomerRole', () => {
  it.each([
    [null, true],
    [undefined, true],
    [{ name: 'prayer_user' }, true],
    [{ name: 'prayer_administrator' }, false],
    [{ name: 'prayer_global_admin' }, false],
  ])('%j → customer %s', (role, expected) => {
    expect(isCustomerRole(role)).toBe(expected)
  })
})
