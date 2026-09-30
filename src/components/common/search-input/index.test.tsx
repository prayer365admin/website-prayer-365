import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SearchInput from './index'

describe('SearchInput', () => {
  const setup = () => {
    const setValue = vi.fn()
    const setPage = vi.fn()
    const setPageSize = vi.fn()
    render(<SearchInput setValue={setValue} setPage={setPage} setPageSize={setPageSize} />)
    return { setValue, setPage, setPageSize }
  }

  it('submits the typed value on Enter and resets page/size', async () => {
    const user = userEvent.setup()
    const { setValue, setPage, setPageSize } = setup()
    await user.type(screen.getByPlaceholderText(/search by name/i), 'alice')
    await user.keyboard('{Enter}')
    expect(setValue).toHaveBeenCalledWith('alice')
    expect(setPage).toHaveBeenCalledWith(1)
    expect(setPageSize).toHaveBeenCalledWith(10)
  })

  it('clears the value on the close icon', async () => {
    const user = userEvent.setup()
    const { setPage, setPageSize } = setup()
    await user.type(screen.getByPlaceholderText(/search by name/i), 'alice')
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('img', { name: 'close-circle' }))
    expect(setPage).toHaveBeenCalledWith(1)
    expect(setPageSize).toHaveBeenCalledWith(10)
  })
})
