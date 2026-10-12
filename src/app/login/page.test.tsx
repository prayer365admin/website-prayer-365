import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Page from './page'

describe('Customer login route', () => {
  it('renders the customer sign-in page', () => {
    renderWithProviders(<Page />)

    expect(screen.getByRole('heading', { name: 'PRAYER' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
  })
})
