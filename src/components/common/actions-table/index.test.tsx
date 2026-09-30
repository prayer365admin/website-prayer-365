import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import ActionsTable from './index'

describe('ActionsTable', () => {
  it('calls onEdit when edit is clicked', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderWithProviders(
      <ActionsTable
        entity="user"
        details="alice@x.com"
        actions="delete"
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    await user.click(screen.getByRole('img', { name: 'edit' }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('shows a delete confirm and calls onDelete on ok', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    renderWithProviders(
      <ActionsTable
        entity="user"
        details="alice@x.com"
        actions="delete"
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    )
    await user.click(screen.getByRole('img', { name: 'delete' }))
    expect((await screen.findAllByText('Are you sure?')).length).toBeGreaterThan(0)
    await user.click((await screen.findAllByRole('button', { name: /ok/i }))[0])
    expect(onDelete).toHaveBeenCalled()
  })
})
