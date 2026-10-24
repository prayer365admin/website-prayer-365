import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import { axiosMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
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
    slug: 'c1',
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
    slug: 'c2',
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
    expect(screen.queryByText('Spiritual Reflections & Calling')).toBeNull()
  })

  const extraChurches: MobileMyChurch[] = [
    ...churches,
    {
      churchId: 'c3',
      slug: 'c3',
      churchName: 'Abbey of Peace',
      city: 'Pärnu',
      address: 'Pärnu',
      coverAssetId: null,
      coverUrl: null,
      isMain: false,
      isFollowed: true,
    },
  ]

  const optionsResponse = (url: string) =>
    Promise.resolve({
      data: {
        result: url.includes('/public/churches')
          ? [
              { id: 'c1', name: 'Primary Church', city: 'Tallinn' },
              { id: 'c4', name: 'Monastery of St. Bridget', city: 'Pirita' },
            ]
          : [],
      },
    })

  const openPicker = async () => {
    await userEvent.click(screen.getByRole('button', { name: /Add another parish or monastery/ }))
    return screen.findByRole('dialog')
  }

  const names = (list: HTMLElement) =>
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.querySelector('strong')?.textContent)

  it('lists the primary church first, then followed churches alphabetically, then the rest', async () => {
    axiosMock.get.mockImplementation(optionsResponse)
    renderWithProviders(<ChurchAffiliations initialChurches={extraChurches} initialMe={me} />)
    const dialog = await openPicker()

    const [followedList, otherList] = await waitFor(() => {
      const lists = within(dialog).getAllByRole('list')
      expect(lists).toHaveLength(2)
      return lists
    })
    expect(names(followedList)).toEqual(['Primary Church', 'Abbey of Peace', 'Followed Church'])
    expect(names(otherList)).toEqual(['Monastery of St. Bridget'])

    // Primary row: no Make Primary / Follow / Unfollow actions.
    const primaryRow = within(followedList).getAllByRole('listitem')[0]
    expect(within(primaryRow).queryAllByRole('button')).toHaveLength(0)
    // Followed rows: Make Primary + Unfollow. Others: Make Primary + Follow.
    expect(within(dialog).getByRole('button', { name: 'Unfollow Followed Church' })).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Set Followed Church as primary parish' }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('button', { name: 'Follow Monastery of St. Bridget' }),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('button', {
        name: 'Set Monastery of St. Bridget as primary parish',
      }),
    ).toBeTruthy()
  })

  it('filters both sections by church name', async () => {
    axiosMock.get.mockImplementation(optionsResponse)
    renderWithProviders(<ChurchAffiliations initialChurches={extraChurches} initialMe={me} />)
    const dialog = await openPicker()

    await userEvent.type(within(dialog).getByRole('textbox'), 'abbey')

    const followedList = within(dialog).getAllByRole('list')[0]
    expect(names(followedList)).toEqual(['Abbey of Peace'])
    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/public/churches', {
        params: { search: 'abbey' },
      }),
    )
  })

  it('discards picker changes on Cancel', async () => {
    axiosMock.get.mockImplementation(optionsResponse)
    renderWithProviders(<ChurchAffiliations initialChurches={churches} initialMe={me} />)
    const dialog = await openPicker()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Unfollow Followed Church' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(axiosMock.delete).not.toHaveBeenCalled()
    expect(axiosMock.patch).not.toHaveBeenCalled()
    const reopened = await openPicker()
    expect(within(reopened).getByRole('button', { name: 'Unfollow Followed Church' })).toBeTruthy()
  })

  it('saves the new primary, follows and unfollows from the picker', async () => {
    axiosMock.get.mockImplementation(optionsResponse)
    renderWithProviders(<ChurchAffiliations initialChurches={churches} initialMe={me} />)
    const dialog = await openPicker()

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Set Followed Church as primary parish' }),
    )
    await userEvent.click(
      await within(dialog).findByRole('button', { name: 'Follow Monastery of St. Bridget' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Unfollow Primary Church' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', { mainChurchId: 'c2' }),
    )
    await waitFor(() => {
      expect(axiosMock.put).toHaveBeenCalledWith('/api/v1/site/me/follows/c4')
      expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/site/me/follows/c1')
    })
    expect(screen.getByRole('heading', { level: 2, name: 'Followed Church' })).toBeTruthy()
  })

  it('keeps upcoming events hidden for the primary church', async () => {
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

    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/churches/c1/events'),
    )
    expect(screen.queryByText('Sunday Eucharistic Service')).toBeNull()
  })
})
