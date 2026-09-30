import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Counter from './index'

describe('Counter', () => {
  it('renders the starting value', () => {
    render(<Counter from={1200} to={2000} />)
    expect(screen.getByText('1200')).toBeTruthy()
  })
})
