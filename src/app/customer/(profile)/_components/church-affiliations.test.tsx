import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import { axiosMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChurchAffiliations from './church-affiliations'

const me: MobileMe = {
  id: 'u1',
  email: 'maria@example.com',
  name: 'Maria',
  locale: 'en',
  profilePicture: null,
  mainChurchId: 'c1',
}

const churches: MobileMyChurch[] = [
  {
    churchId: 'c1',
    churchName: 'Primary Church',
    city: 'Tallinn',
    address: 'Vabaduse väljak 1, Tallinn',
    coverAssetId: null,
    coverUrl: null,
    isMain: true,
    isFollowed: true,
  },
  {
    churchId: 'c2',
    churchName: 'Followed Church',
    city: 'Tartu',
    address: 'Tartu Old Town',
    coverAssetId: null,
    coverUrl: null,
    isMain: false,
    isFollowed: true,
  },
]

describe('ChurchAffiliations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    axiosMock.get.mockResolvedValue({ data: { result: [] } })
    axiosMock.patch.mockResolvedValue({ data: { result: { ...me, mainChurchId: 'c2' } } })
  })

  it('shows each followed church address and notifications off', () => {
    renderWithProviders(<ChurchAffiliations initialChurches={churches} initialMe={me} />)

    expect(screen.getByText('Tartu Old Town')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Notifications off for Followed Church' }),
    ).toBeTruthy()
  })

  it('stages a primary church change and persists it only after Save', async () => {
    renderWithProviders(<ChurchAffiliations initialChurches={churches} initialMe={me} />)
    const save = screen.getByRole('button', { name: 'Save Changes' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })

    expect(save).toHaveProperty('disabled', true)
    expect(cancel).toHaveProperty('disabled', true)

    await userEvent.click(screen.getByRole('button', { name: 'Change Primary Parish' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Set Followed Church as primary parish' }),
    )

    expect(save).toHaveProperty('disabled', false)
    expect(axiosMock.patch).not.toHaveBeenCalled()
    await userEvent.click(save)

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
        mainChurchId: 'c2',
      }),
    )
  })

  it('shows upcoming events from the primary church', async () => {
    axiosMock.get.mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          result: url.includes('/events')
            ? [
                {
                  id: 'event-1',
                  churchId: 'c1',
                  category: 'service',
                  title: 'Sunday Eucharistic Service',
                  description: '',
                  startsAt: '2026-10-25T10:00:00.000Z',
                  location: 'Main sanctuary',
                  registrationUrl: null,
                  languageCode: 'en',
                },
              ]
            : [],
        },
      }),
    )

    renderWithProviders(<ChurchAffiliations initialChurches={churches} initialMe={me} />)

    expect(await screen.findByText('Sunday Eucharistic Service')).toBeTruthy()
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/mobile/churches/c1/events', {
      params: { page: 1, limit: 5 },
    })
  })
})
