import { describe, expect, it } from 'vitest'
import customSlugify from './slugify'

describe('customSlugify', () => {
  it('slugifies simple text', () => {
    expect(customSlugify({ text: 'Hello World', isExists: false })).toBe('hello-world')
  })

  it('appends random suffix when isExists', () => {
    const result = customSlugify({ text: 'Brand New', isExists: true })
    expect(result).toMatch(/^brand-new-[a-zA-Z0-9]{6}$/)
  })
})
