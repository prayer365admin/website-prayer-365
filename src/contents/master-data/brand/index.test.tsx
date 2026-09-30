import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ContentsMasterDataBrand from './index'

describe('ContentsMasterDataBrand', () => {
  it('renders the create-brand button', () => {
    renderWithProviders(<ContentsMasterDataBrand />)
    expect(screen.getByRole('button', { name: /create brand/i })).toBeTruthy()
  })
})
