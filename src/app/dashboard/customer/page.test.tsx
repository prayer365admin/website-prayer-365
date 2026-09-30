import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import Page from './page'

describe('Customer route page', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('renders customers through the route', async () => {
    axiosMock.get.mockResolvedValue({
      data: resolveGet(
        [{ id: 'c1', name: 'Alice', email: 'a@x.com', created_at: '2026-01-01T00:00:00Z' }],
        1,
      ),
    })
    renderWithProviders(<Page />)
    expect(await screen.findByText('Alice')).toBeTruthy()
  })
})
