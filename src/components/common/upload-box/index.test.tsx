import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/frontend/render'
import UploadBox from './index'

describe('UploadBox', () => {
  it('shows the upload placeholder when no url is set', () => {
    renderWithProviders(<UploadBox upload={{ url: null }} setUpload={vi.fn()} />)
    expect(screen.getByText('Upload')).toBeTruthy()
  })

  it('renders a remove button for an image url and clears it on click', async () => {
    const user = userEvent.setup()
    const setUpload = vi.fn()
    renderWithProviders(
      <UploadBox upload={{ url: 'https://example.com/photo.png' }} setUpload={setUpload} />,
    )
    const remove = await screen.findByRole('button', { name: /remove image/i })
    await user.click(remove)
    expect(setUpload).toHaveBeenCalledWith({ url: '' })
  })

  it('shows upload placeholder with a label', () => {
    renderWithProviders(
      <UploadBox upload={{ url: null }} setUpload={vi.fn()} label="Profile Picture" />,
    )
    expect(screen.getByText('Upload')).toBeTruthy()
  })
})
