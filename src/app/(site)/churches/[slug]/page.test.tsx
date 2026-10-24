import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

vi.mock('@/contents/site/church-profile', () => ({
  default: ({ slug }: { slug: string }) => <div data-testid="church-profile">{slug}</div>,
}))

describe('Church Profile Page', () => {
  it('passes slug param to ContentsSiteChurchProfile', async () => {
    const tree = await Page({ params: Promise.resolve({ slug: 'c1' }) })
    const { getByTestId } = render(tree)
    expect(getByTestId('church-profile').textContent).toBe('c1')
  })
})
