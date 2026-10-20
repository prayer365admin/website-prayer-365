import type { MobileMe, MobileMyChurch } from '@/models/mobile'
import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import CustomerProfileHeader from './customer-profile-header'

const me: MobileMe = {
  id: '019a0000-0000-7000-8000-000000008070',
  email: 'maria@example.com',
  name: 'Maria',
  locale: 'en',
  profilePicture: null,
  mainChurchId: 'c1',
}

const churches: MobileMyChurch[] = [
  {
    churchId: 'c1',
    churchName: 'Tallinn Demo Church',
    city: 'Tallinn',
    address: null,
    coverAssetId: null,
    coverUrl: null,
    isMain: true,
    isFollowed: true,
  },
]

describe('CustomerProfileHeader', () => {
  beforeEach(() => {
    sessionMock.mockReturnValue({ data: { user: { user_id: me.id } }, status: 'authenticated' })
  })

  it('renders the live customer identity and primary sanctuary', () => {
    renderWithProviders(
      <CustomerProfileHeader
        createdAt="2024-10-01T00:00:00.000Z"
        initialChurches={churches}
        initialMe={me}
        verified
      />,
    )

    expect(screen.getByRole('heading', { name: 'Maria' })).toBeTruthy()
    expect(screen.getByText('Verified Parishioner')).toBeTruthy()
    expect(screen.getByText('Member since Oct 2024')).toBeTruthy()
    expect(screen.getByText('Tallinn Demo Church')).toBeTruthy()
  })

  it('does not invent verification or a chaplain assignment', () => {
    renderWithProviders(
      <CustomerProfileHeader
        createdAt="2024-10-01T00:00:00.000Z"
        initialChurches={[]}
        initialMe={me}
        verified={false}
      />,
    )

    expect(screen.queryByText('Verified Parishioner')).toBeNull()
    expect(screen.getByText('Not assigned')).toBeTruthy()
    expect(screen.getByText('Not selected')).toBeTruthy()
  })
})
