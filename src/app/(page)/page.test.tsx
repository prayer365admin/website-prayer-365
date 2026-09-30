import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import Page from './page'

describe('Root route page', () => {
  it('renders the homepage content through the route', () => {
    renderWithProviders(<Page />)
    expect(screen.getByText('Homepage')).toBeTruthy()
  })
})
