import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import AddButton from './index'

describe('AddButton', () => {
  it('renders label and calls onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    renderWithProviders(<AddButton label="Add User" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: /add user/i }))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders nothing when no create permission', () => {
    renderWithProviders(<AddButton label="Add User" permissionSubject="user" />)
    // helper session is unauthenticated → non-user role → no create grant
    expect(screen.queryByRole('button')).toBeNull()
  })
})
