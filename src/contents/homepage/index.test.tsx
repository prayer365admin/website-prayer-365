import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ContentsHomepage from './index'

describe('ContentsHomepage', () => {
  it('renders the homepage content', () => {
    renderWithProviders(<ContentsHomepage />)
    expect(screen.getByText('Homepage')).toBeTruthy()
  })
})
