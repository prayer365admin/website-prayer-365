import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import Page from './page'

describe('Register route page', () => {
  it('renders the register form through the route', () => {
    renderWithProviders(<Page />)
    expect(screen.getByRole('heading', { name: 'Register' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Register' })).toBeTruthy()
  })
})
