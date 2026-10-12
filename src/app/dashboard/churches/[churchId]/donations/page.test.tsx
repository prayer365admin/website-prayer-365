import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Page from './page'

vi.mock('@/contents/churches/donations', () => ({
  default: ({ churchId }: { churchId: string }) => (
    <div data-testid="contents-donations">{churchId}</div>
  ),
}))

describe('Donations Route Page', () => {
  it('unrolls params and passes churchId to ContentsChurchDonations', async () => {
    const params = Promise.resolve({ churchId: 'c1' })
    const { findByTestId } = render(await Page({ params }))

    const contents = await findByTestId('contents-donations')
    expect(contents.textContent).toBe('c1')
  })
})
