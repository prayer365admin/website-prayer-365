import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import FormRole from './index'

describe('FormRole', () => {
  it('renders name field and submits a payload', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } })
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<FormRole onSubmit={onSubmit} />)

    await user.type(screen.getByPlaceholderText('Administrator'), 'Admin')
    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Admin' }))
  })
})
