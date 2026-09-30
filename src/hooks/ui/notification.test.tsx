import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import { useMainNotification } from './notification'

function Harness({ type }: { type: 'success' | 'error' }) {
  const notify = useMainNotification()
  return (
    <button onClick={() => notify({ type, entity: 'user', action: 'created' })}>trigger</button>
  )
}

describe('useMainNotification', () => {
  it('fires a success notification', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness type="success" />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(await screen.findByText('Success!')).toBeTruthy()
    expect(screen.getByText(/user has been successfully created/i)).toBeTruthy()
  })

  it('fires an error notification', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness type="error" />)
    await user.click(screen.getByRole('button', { name: 'trigger' }))
    expect(await screen.findByText('Error!')).toBeTruthy()
    expect(screen.getByText(/something went wrong with user/i)).toBeTruthy()
  })
})
