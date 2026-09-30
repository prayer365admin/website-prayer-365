import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import { useConfirmModal } from './confirm-modal'

function Harness({ onOk, onCancel }: { onOk?: () => void; onCancel?: () => void }) {
  const confirm = useConfirmModal({
    entity: 'user',
    details: 'alice@x.com',
    actions: 'delete',
    onOk,
    onCancel,
  })
  return <button onClick={confirm}>do</button>
}

describe('useConfirmModal', () => {
  it('opens a confirm dialog with entity details', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.click(screen.getByRole('button', { name: 'do' }))
    expect((await screen.findAllByText('Are you sure?')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/user/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/delete/i).length).toBeGreaterThan(0)
  })

  it('calls onOk when confirmed', async () => {
    const onOk = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<Harness onOk={onOk} />)
    await user.click(screen.getByRole('button', { name: 'do' }))
    await user.click(await screen.findByRole('button', { name: /ok/i }))
    expect(onOk).toHaveBeenCalled()
  })

  it('calls onCancel when cancelled', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<Harness onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'do' }))
    await user.click(await screen.findByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })
})
