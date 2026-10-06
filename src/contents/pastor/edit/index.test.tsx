import { renderWithProviders, searchParamsMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  onUpdate: vi.fn(),
  onAssign: vi.fn(),
  onUnassign: vi.fn(),
}))

vi.mock('@/hooks/data/central', () => ({
  usePastor: () => ({
    data: {
      id: 'pastor-1',
      version: 4,
      name: 'Pastor A',
      introduction: 'Bio',
      user_id: 'user-1',
      user: { id: 'user-1', name: 'Staff A', email: 'staff@example.com' },
      churches: [{ churchId: 'church-old', churchName: 'Old Church' }],
    },
    error: null,
    loading: false,
    onUpdate: hooks.onUpdate,
  }),
  useAssignPastorToChurch: () => ({ onAssign: hooks.onAssign, loading: false }),
  useUnassignPastorFromChurch: () => ({ onUnassign: hooks.onUnassign, loading: false }),
}))
vi.mock('@/components/common/form/pastor', () => ({
  default: ({
    onSubmit,
    initialLinkedStaff,
  }: {
    onSubmit: (payload: unknown) => Promise<void>
    initialLinkedStaff?: { name: string }
  }) => (
    <div>
      <span>{initialLinkedStaff?.name}</span>
      <button
        onClick={() =>
          void onSubmit({
            name: 'Pastor Updated',
            introduction: 'Bio',
            userId: 'user-1',
            assignments: [{ churchId: 'church-new' }],
          })
        }
      >
        Submit pastor
      </button>
    </div>
  ),
}))

import ContentsPastorEdit from './index'

describe('ContentsPastorEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParamsMock.get.mockReturnValue(null)
    hooks.onUpdate.mockResolvedValue({})
    hooks.onAssign.mockResolvedValue({})
    hooks.onUnassign.mockResolvedValue({})
  })

  it('sends the current version and reconciles added/removed churches', async () => {
    renderWithProviders(<ContentsPastorEdit />)
    expect(screen.getByText('Staff A')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Submit pastor' }))

    await waitFor(() => expect(hooks.onUnassign).toHaveBeenCalledTimes(1))
    expect(hooks.onUpdate).toHaveBeenCalledWith({
      version: 4,
      name: 'Pastor Updated',
      introduction: 'Bio',
      userId: 'user-1',
    })
    expect(hooks.onAssign).toHaveBeenCalledWith({
      churchId: 'church-new',
      assigned: { churchId: 'church-new', pastorId: 'r1' },
    })
    expect(hooks.onUnassign).toHaveBeenCalledWith({
      churchId: 'church-old',
      pastorId: 'r1',
    })
  })

  it('keeps the screen recoverable when relationship changes partially fail', async () => {
    hooks.onAssign.mockRejectedValueOnce(new Error('assignment failed'))
    renderWithProviders(<ContentsPastorEdit />)
    await userEvent.click(screen.getByRole('button', { name: 'Submit pastor' }))

    expect(await screen.findByText('Church assignments need attention')).toBeTruthy()
    expect(
      screen.getByText(/1 church assignment change failed, so the profile changes were not saved/i),
    ).toBeTruthy()
    expect(hooks.onUpdate).not.toHaveBeenCalled()
  })

  it('explains partial assignment work redirected from create', () => {
    searchParamsMock.get.mockReturnValue('partial')
    renderWithProviders(<ContentsPastorEdit />)

    expect(screen.getByText('Church assignments need attention')).toBeTruthy()
    expect(
      screen.getByText(/profile was created, but one or more church assignments failed/i),
    ).toBeTruthy()
  })
})
