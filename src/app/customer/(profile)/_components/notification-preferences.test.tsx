import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationPreferences from './notification-preferences'

const initial = {
  dailyPrayer: true,
  sundayService: true,
  churchEvents: true,
  announcements: true,
  platformInformation: true,
  donationReminder: true,
}

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockResolvedValue({ data: { result: initial } })
    axiosMock.put.mockResolvedValue({ data: { result: { ...initial, dailyPrayer: false } } })
  })

  it('renders one switch per notification type', () => {
    renderWithProviders(<NotificationPreferences initial={initial} />)

    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByText('Daily Prayer')).toBeTruthy()
  })

  it('saves the whole object with the toggled key flipped', async () => {
    renderWithProviders(<NotificationPreferences initial={initial} />)

    fireEvent.click(screen.getAllByRole('switch')[0])

    await waitFor(() =>
      expect(axiosMock.put).toHaveBeenCalledWith('/api/v1/site/me/notification-preferences', {
        ...initial,
        dailyPrayer: false,
      }),
    )
  })

  it('tells the customer when the save fails', async () => {
    axiosMock.put.mockRejectedValue(new Error('nope'))
    renderWithProviders(<NotificationPreferences initial={initial} />)

    fireEvent.click(screen.getAllByRole('switch')[0])

    await waitFor(() =>
      expect(screen.getByText('Could not save your preferences. Please try again.')).toBeTruthy(),
    )
  })
})
