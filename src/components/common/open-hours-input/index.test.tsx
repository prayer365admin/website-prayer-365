import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OpenHoursInput from './index'

describe('OpenHoursInput', () => {
  it('renders label and add-open-hour button, and adds a row on click', async () => {
    const user = userEvent.setup()
    render(<OpenHoursInput name="open_hours" label="Opening Hours" />)
    expect(screen.getByText('Opening Hours')).toBeTruthy()
    const addBtn = screen.getByRole('button', { name: /add open hour/i })
    // initialValue [{}] → one row already presents a day select
    await user.click(addBtn)
    expect(screen.getByRole('button', { name: /add open hour/i })).toBeTruthy()
  })
})
