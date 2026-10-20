import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteProfile from '.'

const en = SITE_MESSAGES.en

const me = {
  id: 'u1',
  email: 'maria@example.com',
  name: 'Maria',
  // CHAR(10) column: the database returns it space-padded.
  locale: 'et        ',
  profilePicture: null,
  mainChurchId: 'c1',
}
const churches = [
  {
    churchId: 'c1',
    churchName: 'Tallinna Jaani',
    city: 'Tallinn',
    address: null,
    coverAssetId: null,
    coverUrl: null,
    isMain: true,
    isFollowed: true,
  },
  {
    churchId: 'c2',
    churchName: 'Tartu Pauluse',
    city: 'Tartu',
    address: null,
    coverAssetId: null,
    coverUrl: null,
    isMain: false,
    isFollowed: true,
  },
]

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteProfile />
    </SiteI18nProvider>,
  )

describe('Website profile /customer (W13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockReset()
    axiosMock.patch.mockReset()
    axiosMock.delete.mockReset()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url === '/api/v1/site/me') return { data: { result: me } }
      if (url === '/api/v1/site/me/churches') return { data: { result: churches } }
      return { data: { result: [] } } // public church search
    })
    axiosMock.patch.mockResolvedValue({ data: { result: me } })
    axiosMock.delete.mockResolvedValue({ data: {} })
  })

  it('loads the profile: email read-only, name, trimmed language, followed churches', async () => {
    renderPage()

    const name = (await screen.findByLabelText(en.profileNameLabel)) as HTMLInputElement
    expect(name.value).toBe('Maria')
    expect((screen.getByDisplayValue('maria@example.com') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByText('Eesti')).toBeTruthy()
    expect(screen.getByText('Tartu Pauluse, Tartu')).toBeTruthy()
  })

  it('renders server-loaded data immediately without a load warning or client read', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteProfile initialChurches={churches} initialMe={me} />
      </SiteI18nProvider>,
    )

    expect(screen.getByDisplayValue('maria@example.com')).toBeTruthy()
    expect(screen.queryByText(en.profileLoadError)).toBeNull()
    expect(axiosMock.get).not.toHaveBeenCalledWith('/api/v1/site/me')
    expect(axiosMock.get).not.toHaveBeenCalledWith('/api/v1/site/me/churches')
  })

  it('saves name + language + main church, then unfollows a removed church', async () => {
    renderPage()
    const name = await screen.findByLabelText(en.profileNameLabel)
    await userEvent.clear(name)
    await userEvent.type(name, ' Maria L ')
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.profileRemoveChurch) }))
    await userEvent.click(screen.getByRole('button', { name: en.profileSave }))

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
        name: 'Maria L',
        locale: 'et',
        mainChurchId: 'c1',
      }),
    )
    await waitFor(() => expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/site/me/follows/c2'))
  })

  it('requires a name', async () => {
    renderPage()
    await userEvent.clear(await screen.findByLabelText(en.profileNameLabel))
    await userEvent.click(screen.getByRole('button', { name: en.profileSave }))

    expect(await screen.findByText(en.signUpErrorName)).toBeTruthy()
    expect(axiosMock.patch).not.toHaveBeenCalled()
  })

  it('warns when a church change fails after the profile saved', async () => {
    axiosMock.delete.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await screen.findByLabelText(en.profileNameLabel)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.profileRemoveChurch) }))
    await userEvent.click(screen.getByRole('button', { name: en.profileSave }))

    expect(await screen.findByText(en.profileFollowsFailed.replace('{count}', '1'))).toBeTruthy()
  })

  it('shows an error when the profile cannot be loaded', async () => {
    axiosMock.get.mockImplementation(async (url: string) => {
      if (url === '/api/v1/site/me') throw new Error('down')
      return { data: { result: [] } }
    })
    renderPage()

    expect(await screen.findByText(en.profileLoadError)).toBeTruthy()
  })
})
