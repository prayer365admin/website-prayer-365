import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Page from './page'

describe('Staff login route', () => {
  it('renders the staff dashboard sign-in page', () => {
    renderWithProviders(<Page />)

    expect(screen.getByRole('heading', { name: 'Prayer Dashboard' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
  })
})
