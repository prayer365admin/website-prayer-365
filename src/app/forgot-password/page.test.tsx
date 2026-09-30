import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import Page from './page'

describe('Forgot password route page', () => {
  it('renders the forgot-password form through the route', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Forgot Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeTruthy()
  })
})
