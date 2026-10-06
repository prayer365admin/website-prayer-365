import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  churches: vi.fn(),
  staff: vi.fn(),
}))

vi.mock('@/hooks/data/central', () => ({
  useCentralChurches: () => hooks.churches(),
  usePastorStaffOptions: () => hooks.staff(),
}))

import FormPastor from './index'

describe('FormPastor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hooks.churches.mockReturnValue({
      data: [{ id: 'church-1', name: 'Grace Church', status: 'APPROVED' }],
      isLoading: false,
      error: null,
    })
    hooks.staff.mockReturnValue({ data: [], isLoading: false, error: null })
  })

  it('normalizes the shared profile fields before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithProviders(
      <FormPastor
        onSubmit={onSubmit}
        loading={false}
        initialValues={{ name: '  Pastor A  ', introduction: '  Biography  ' }}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Pastor A',
        introduction: 'Biography',
        imageAssetId: null,
        imageChurchId: null,
        userId: null,
        assignments: [],
      }),
    )
  })

  it('keeps the currently linked staff account selectable when absent from options', () => {
    renderWithProviders(
      <FormPastor
        type="UPDATE"
        loading={false}
        onSubmit={vi.fn()}
        initialValues={{ name: 'Pastor A', userId: 'user-1' }}
        initialLinkedStaff={{ id: 'user-1', name: 'Staff A', email: 'staff@example.com' }}
      />,
    )

    expect(screen.getByText('Staff A (staff@example.com)')).toBeTruthy()
  })

  it('warns when church or staff assignment options cannot be loaded', () => {
    hooks.churches.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('failed'),
    })
    renderWithProviders(<FormPastor onSubmit={vi.fn()} loading={false} />)

    expect(screen.getByText('Some assignment options could not be loaded')).toBeTruthy()
  })
})
