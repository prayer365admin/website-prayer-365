import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usePastors = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/data/central', () => ({ usePastors }))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
vi.mock('@/components/common/search-input', () => ({
  default: () => <input aria-label="Search" />,
}))
vi.mock('./columns', () => ({
  PastorColumns: () => [
    { key: 'name', title: 'Name', render: (_: unknown, row: { name: string }) => row.name },
  ],
}))

import ContentsPastor from './index'

describe('ContentsPastor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the central pastor directory data', () => {
    usePastors.mockReturnValue({
      data: [{ id: 'pastor-1', name: 'Pastor A' }],
      total: 1,
      loading: false,
      error: null,
      onDelete: vi.fn(),
    })
    renderWithProviders(<ContentsPastor />)

    expect(screen.getByRole('heading', { name: 'Pastor Profiles' })).toBeTruthy()
    expect(screen.getByText('Pastor A')).toBeTruthy()
    expect(usePastors).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 10 }))
  })

  it('shows a useful load error', () => {
    usePastors.mockReturnValue({
      data: [],
      total: 0,
      loading: false,
      error: new Error('failed'),
      onDelete: vi.fn(),
    })
    renderWithProviders(<ContentsPastor />)

    expect(screen.getByText('Pastor profiles could not be loaded')).toBeTruthy()
  })
})
