import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

vi.mock('@/contents/site/church-directory', () => ({
  default: () => <div data-testid="church-directory">Church Directory</div>,
}))

describe('Churches Page', () => {
  it('renders ContentsSiteChurchDirectory', () => {
    const { getByTestId } = render(<Page />)
    expect(getByTestId('church-directory')).toBeTruthy()
  })
})
