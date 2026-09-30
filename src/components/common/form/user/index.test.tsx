import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import FormUser from './index'

describe('FormUser', () => {
  it('submits email, name and a valid password payload', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } }) // roles for SelectRole
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<FormUser onSubmit={onSubmit} type="CREATE" />)

    await user.type(screen.getByPlaceholderText('Ex. admin@catatia.com'), 'admin@x.com')
    await user.type(screen.getByPlaceholderText('Ex. Administrator'), 'Alice')
    // CREATE requires a strong password (both password + confirm_password)
    const passwords = screen.getAllByPlaceholderText('Password')
    await user.type(passwords[0], 'Strong@123')
    await user.type(passwords[1], 'Strong@123')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@x.com', name: 'Alice', password: 'Strong@123' }),
    )
  })
})
