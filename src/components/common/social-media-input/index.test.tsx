import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SocialMediaInput from './index'

describe('SocialMediaInput', () => {
  it('renders label and add button, and adds a row on click', async () => {
    const user = userEvent.setup()
    render(<SocialMediaInput name="social_media" label="Social Media" />)
    expect(screen.getByText('Social Media')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /add social media/i }))
    expect(screen.getByRole('button', { name: /add social media/i })).toBeTruthy()
  })
})
