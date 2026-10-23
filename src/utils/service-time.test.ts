import { describe, expect, it } from 'vitest'
import { formatServiceTime } from './service-time'

describe('formatServiceTime', () => {
  it('formats Sunday Divine Service with Holy Communion 10:00 to Sun 10:00 AM', () => {
    const raw =
      'Sunday Divine Service with Holy Communion 10:00 • Evening Choral Contemplation & Organ 17:00'
    expect(formatServiceTime(raw)).toBe('Sun 10:00 AM • Sun 5:00 PM')
  })

  it('handles single service time', () => {
    expect(formatServiceTime('Sunday Service 09:30')).toBe('Sun 9:30 AM')
  })

  it('handles weekday services', () => {
    expect(formatServiceTime('Wednesday Bible Study 18:30')).toBe('Wed 6:30 PM')
  })

  it('handles existing AM/PM', () => {
    expect(formatServiceTime('Sun 10:00 AM')).toBe('Sun 10:00 AM')
  })

  it('handles empty or null input gracefully', () => {
    expect(formatServiceTime(null)).toBe('')
    expect(formatServiceTime('')).toBe('')
  })
})
