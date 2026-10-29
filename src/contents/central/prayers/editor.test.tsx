import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  useCentralPrayer: vi.fn(),
  useChurches: vi.fn(),
}))

vi.mock('@/hooks/data/prayer', () => ({ useCentralPrayer: hooks.useCentralPrayer }))
vi.mock('@/hooks/data/church', () => ({ useChurches: hooks.useChurches }))
vi.mock('@/contents/churches/prayers/editor', () => ({
  default: ({
    churchId,
    prayerId,
    churchContext,
    formDisabled,
  }: {
    churchId: string
    prayerId?: string
    churchContext?: React.ReactNode
    formDisabled?: boolean
  }) => (
    <div>
      <h1>{prayerId ? 'Existing Prayer' : 'New Prayer'}</h1>
      {churchContext}
      <div data-disabled={formDisabled} data-testid="prayer-editor">
        {churchId}:{prayerId ?? 'new'}
      </div>
    </div>
  ),
}))

import ContentsCentralPrayerEditor from './editor'

describe('ContentsCentralPrayerEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hooks.useChurches.mockReturnValue({
      data: [{ id: 'church-1', name: 'Authorized Church' }],
      loading: false,
    })
    hooks.useCentralPrayer.mockReturnValue({ data: undefined, loading: false, error: null })
  })

  it('shows the full create form immediately and enables scoped fields after church selection', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralPrayerEditor />)

    expect(screen.getByRole('heading', { name: 'New Prayer' })).toBeTruthy()
    expect(screen.getByTestId('prayer-editor').getAttribute('data-disabled')).toBe('true')

    await user.click(screen.getByRole('combobox', { name: 'Church' }))
    await user.click(screen.getByText('Authorized Church'))

    expect(screen.getByTestId('prayer-editor').textContent).toBe('church-1:new')
    expect(screen.getByTestId('prayer-editor').getAttribute('data-disabled')).toBe('false')
  })

  it('resolves the church for Central editing instead of using header context', () => {
    hooks.useCentralPrayer.mockReturnValue({
      data: {
        id: 'prayer-1',
        churchId: 'church-1',
        churchName: 'Authorized Church',
      },
      loading: false,
      error: null,
    })

    renderWithProviders(<ContentsCentralPrayerEditor prayerId="prayer-1" />)

    expect(screen.getByTestId('prayer-editor').textContent).toBe('church-1:prayer-1')
  })
})
