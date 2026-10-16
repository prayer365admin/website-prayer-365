import { describe, expect, it } from 'vitest'
import { lectionaryYear, readingMinutes } from './data'

describe('lectionaryYear', () => {
  it('switches cycle on the first Sunday of Advent', () => {
    expect(lectionaryYear(new Date('2026-10-16T00:00:00Z'))).toBe('A')
    expect(lectionaryYear(new Date('2026-11-28T23:59:59Z'))).toBe('A')
    expect(lectionaryYear(new Date('2026-11-29T00:00:00Z'))).toBe('B') // Advent I 2026
    expect(lectionaryYear(new Date('2024-06-01T00:00:00Z'))).toBe('B')
    expect(lectionaryYear(new Date('2024-12-01T00:00:00Z'))).toBe('C') // Advent I 2024
  })

  it('estimates reading minutes at 150 words a minute, never below one', () => {
    expect(readingMinutes('Amen.')).toBe(1)
    expect(readingMinutes(Array(900).fill('word').join(' '))).toBe(6)
  })
})
