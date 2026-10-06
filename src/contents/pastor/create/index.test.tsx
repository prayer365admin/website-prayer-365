import { renderWithProviders, replaceMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  onCreate: vi.fn(),
  onAssign: vi.fn(),
}))

vi.mock('@/hooks/data/central', () => ({
  usePastors: () => ({ onCreate: hooks.onCreate, loading: false }),
  useAssignPastorToChurch: () => ({ onAssign: hooks.onAssign, loading: false }),
}))
vi.mock('@/components/common/form/pastor', () => ({
  default: ({ onSubmit }: { onSubmit: (payload: unknown) => Promise<void> }) => (
    <button
      onClick={() =>
        void onSubmit({
          name: 'Pastor A',
          introduction: null,
          userId: null,
          assignments: [{ churchId: 'church-1' }, { churchId: 'church-2' }],
        })
      }
    >
      Submit pastor
    </button>
  ),
}))

import ContentsPastorCreate from './index'

describe('ContentsPastorCreate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the profile and saves its church relationships', async () => {
    hooks.onCreate.mockResolvedValue({ data: { result: { id: 'pastor-1' } } })
    hooks.onAssign.mockResolvedValue({})

    renderWithProviders(<ContentsPastorCreate />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit pastor' }))

    await waitFor(() => expect(hooks.onAssign).toHaveBeenCalledTimes(2))
    expect(hooks.onCreate).toHaveBeenCalledWith({
      name: 'Pastor A',
      introduction: null,
      userId: null,
    })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('redirects to the created profile when an assignment partially fails', async () => {
    hooks.onCreate.mockResolvedValue({ data: { result: { id: 'pastor-1' } } })
    hooks.onAssign.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('assignment failed'))

    renderWithProviders(<ContentsPastorCreate />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit pastor' }))

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(
        '/dashboard/central/pastors/pastor-1?assignmentSave=partial',
      ),
    )
  })
})
