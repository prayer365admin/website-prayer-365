import { afterEach, describe, expect, it } from 'vitest'
import { isMaintenanceEnabled } from './maintenance'

const original = process.env.NEXT_PUBLIC_IS_MAINTENANCE

describe('isMaintenanceEnabled', () => {
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_IS_MAINTENANCE
    else process.env.NEXT_PUBLIC_IS_MAINTENANCE = original
  })

  it('is on only for the exact string "true"', () => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = 'true'

    expect(isMaintenanceEnabled()).toBe(true)
  })

  it.each(['', 'false', '1', 'TRUE', 'yes'])('is off for %j', (value) => {
    process.env.NEXT_PUBLIC_IS_MAINTENANCE = value

    expect(isMaintenanceEnabled()).toBe(false)
  })

  it('is off when the variable is not set', () => {
    delete process.env.NEXT_PUBLIC_IS_MAINTENANCE

    expect(isMaintenanceEnabled()).toBe(false)
  })
})
