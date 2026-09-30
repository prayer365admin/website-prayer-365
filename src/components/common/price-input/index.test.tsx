import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PriceInput from './index'

describe('PriceInput', () => {
  it('renders an InputNumber with the placeholder', () => {
    render(<PriceInput name="price" label="Price" required={false} />)
    expect(screen.getByPlaceholderText('Input Price')).toBeTruthy()
  })

  it('renders without crashing when required', () => {
    render(<PriceInput name="price" label="Price" required />)
    // noStyle Form.Item — label not rendered, but the input is present
    expect(screen.getByPlaceholderText('Input Price')).toBeTruthy()
  })
})
