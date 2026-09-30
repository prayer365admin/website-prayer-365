import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AnimateText from './index'

describe('AnimateText', () => {
  it('renders the label', () => {
    render(<AnimateText />)
    expect(screen.getByText('Animate Text')).toBeTruthy()
  })
})
