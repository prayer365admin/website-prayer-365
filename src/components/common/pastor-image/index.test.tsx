import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import PastorImage from './index'

vi.mock('axios')

beforeEach(() => vi.clearAllMocks())

describe('PastorImage', () => {
  it('fetches a General (church-less) asset without a churchId query', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { result: { url: 'https://cdn/p.png' } } })
    render(<PastorImage imageAssetId="a1" churchId={null} name="John" />)

    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/v1/uploads/a1/access'))
  })

  it('fetches a church-scoped asset with the churchId query', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { result: { url: 'https://cdn/p.png' } } })
    render(<PastorImage imageAssetId="a1" churchId="c1" name="John" />)

    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith('/api/v1/uploads/a1/access?churchId=c1'),
    )
  })

  it('does not fetch when there is no asset id', () => {
    render(<PastorImage imageAssetId={null} churchId="c1" name="John" />)
    expect(axios.get).not.toHaveBeenCalled()
    expect(screen.getByLabelText('John image placeholder')).toBeTruthy()
  })
})
