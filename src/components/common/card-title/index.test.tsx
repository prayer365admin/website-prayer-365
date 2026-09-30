import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import CardTitle from './index'

describe('CardTitle', () => {
  it('renders the title', () => {
    renderWithProviders(<CardTitle title="Church Profile" />)
    expect(screen.getByRole('heading', { name: 'Church Profile' })).toBeTruthy()
  })

  it('renders a clickable back arrow without crashing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<CardTitle title="Reports" />)
    await user.click(screen.getByRole('img', { name: 'arrow-left' }))
  })
})
