import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { axiosMock, renderWithProviders, resolveGet } from '@/test/frontend/render'
import ContentsCustomer from './index'

const customers = [
  { id: 'c1', name: 'Alice', email: 'alice@x.com', created_at: '2026-01-01T00:00:00Z' },
  { id: 'c2', name: 'Bob', email: 'bob@x.com', created_at: '2026-01-02T00:00:00Z' },
]

describe('ContentsCustomer', () => {
  beforeEach(() => {
    axiosMock.get.mockClear()
  })

  it('renders customer rows from the api', async () => {
    axiosMock.get.mockResolvedValue({ data: resolveGet(customers, 2) })
    renderWithProviders(<ContentsCustomer />)
    expect(await screen.findByText('Alice')).toBeTruthy()
    expect(screen.getByText('bob@x.com')).toBeTruthy()
  })
})
