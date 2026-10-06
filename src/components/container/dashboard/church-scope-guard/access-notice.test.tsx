import { renderWithProviders, replaceMock, searchParamsMock } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChurchAccessNotice from './access-notice'

describe('ChurchAccessNotice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing without the notice parameter', () => {
    searchParamsMock.get.mockReturnValue(null)
    renderWithProviders(<ChurchAccessNotice />)

    expect(screen.queryByText('You don’t have access to that church.')).toBeNull()
  })

  it('shows and dismisses the access notice without dropping other query parameters', () => {
    searchParamsMock.get.mockImplementation((key: string) =>
      key === 'notice' ? 'church_access_denied' : null,
    )
    searchParamsMock.toString.mockReturnValue('notice=church_access_denied&tab=profile')
    renderWithProviders(<ChurchAccessNotice />)

    expect(screen.getByText('You don’t have access to that church.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/customers?tab=profile')
  })
})
