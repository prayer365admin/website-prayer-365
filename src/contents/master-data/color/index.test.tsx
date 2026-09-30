import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ContentsMasterDataColor from './index'

describe('ContentsMasterDataColor', () => {
  it('renders the create-color button', () => {
    renderWithProviders(<ContentsMasterDataColor />)
    expect(screen.getByRole('button', { name: /create color/i })).toBeTruthy()
  })
})
