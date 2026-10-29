import { SiteI18nProvider } from '@/i18n/site-i18n'
import type { MobileMe } from '@/models/mobile'
import { axiosMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalProfile from './personal-profile'

const me: MobileMe = {
  id: 'u1',
  email: 'maria@example.com',
  name: 'Maria',
  locale: 'et        ',
  profilePicture: null,
  mainChurchId: 'c1',
}

const renderProfile = (initialMe = me) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PersonalProfile emailVerified initialMe={initialMe} />
    </SiteI18nProvider>,
  )

describe('PersonalProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
    axiosMock.patch.mockResolvedValue({ data: { result: me } })
  })

  it('shows only the supported personal fields', () => {
    renderProfile()

    expect((screen.getByDisplayValue('maria@example.com') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Full Legal or Baptismal Name') as HTMLInputElement).value).toBe(
      'Maria',
    )
    expect(screen.getByText('Eesti')).toBeTruthy()
    expect(screen.getByText('Verified')).toBeTruthy()
    expect(screen.queryByText('Main Church')).toBeNull()
    expect(screen.queryByText('Phone')).toBeNull()
    expect(screen.queryByText('Liturgical & Chime Timezone')).toBeNull()
    expect(screen.getByText('Anchoring Scripture Passages')).toBeTruthy()
    expect(screen.queryByText('Spiritual Reflections & Calling')).toBeNull()
    expect(screen.queryByText('Diaconal Volunteer & Ministry Involvement')).toBeNull()
    expect(screen.queryByText('Ministry involvement will be available soon.')).toBeNull()
  })

  it('does not show a verification badge for an unverified email', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <PersonalProfile emailVerified={false} initialMe={me} />
      </SiteI18nProvider>,
    )

    expect(screen.queryByText('Verified')).toBeNull()
  })

  it('saves name and language without changing church affiliations', async () => {
    renderProfile()
    const name = screen.getByLabelText('Full Legal or Baptismal Name')
    const save = screen.getByRole('button', { name: 'Save Changes' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })

    expect(save).toHaveProperty('disabled', true)
    expect(cancel).toHaveProperty('disabled', true)

    await userEvent.clear(name)
    await userEvent.type(name, 'Maria L')

    expect(save).toHaveProperty('disabled', false)
    expect(cancel).toHaveProperty('disabled', false)

    await userEvent.click(save)

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
        name: 'Maria L',
        locale: 'et',
      }),
    )
    await waitFor(() => expect(save).toHaveProperty('disabled', true))
    expect(cancel).toHaveProperty('disabled', true)
  })

  it('cancels unsaved edits and returns both actions to their inactive state', async () => {
    renderProfile()
    const name = screen.getByLabelText('Full Legal or Baptismal Name') as HTMLInputElement
    const save = screen.getByRole('button', { name: 'Save Changes' })
    const cancel = screen.getByRole('button', { name: 'Cancel' })

    await userEvent.clear(name)
    await userEvent.type(name, 'Temporary name')
    await userEvent.click(cancel)

    expect(name.value).toBe('Maria')
    expect(save).toHaveProperty('disabled', true)
    expect(cancel).toHaveProperty('disabled', true)
    expect(axiosMock.patch).not.toHaveBeenCalled()
  })

  it('removes an existing profile picture through the real profile patch', async () => {
    renderProfile({ ...me, profilePicture: 'https://cdn.example.com/maria.jpg' })
    await userEvent.click(screen.getByRole('button', { name: /Remove/ }))

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
        profilePicture: null,
      }),
    )
  })
})
