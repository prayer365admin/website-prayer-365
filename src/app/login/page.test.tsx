import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import Page from './page'

describe('Login route page', () => {
  it('renders the login form through the route', () => {
    renderWithProviders(<Page />)
    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Username')).toBeTruthy()
  })
})
