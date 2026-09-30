import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import MapsInput from './index'

describe('MapsInput', () => {
  it('renders a textarea with paste placeholder and no clear button initially', () => {
    render(<MapsInput name="maps" label="Location" />)
    expect(screen.getByPlaceholderText('Paste here!')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull()
  })

  it('shows Clear button when an embed initialValue is present', async () => {
    const user = userEvent.setup()
    render(
      <MapsInput
        name="maps"
        label="Location"
        initialValue='<iframe src="https://www.google.com/maps/embed?x=1"></iframe>'
      />,
    )
    const clear = screen.getByRole('button', { name: 'Clear' })
    await user.click(clear)
  })
})
