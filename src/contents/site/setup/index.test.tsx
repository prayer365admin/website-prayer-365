import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import {
  axiosMock,
  pushMock,
  renderWithProviders,
  resolveGet,
  sessionMock,
} from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteSetup from '.'

const en = SITE_MESSAGES.en
const CHURCH = { id: 'c1', name: 'Tallinna Jaani', city: 'Tallinn' }
const ME = {
  id: 'u1',
  email: 'maria@example.com',
  name: 'Maria',
  locale: null,
  profilePicture: null,
  mainChurchId: null,
}
const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteSetup initialMe={ME} locale="en" />
    </SiteI18nProvider>,
  )

const next = () => userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpNext) }))
const finish = () =>
  userEvent.click(screen.getByRole('button', { name: new RegExp(en.setupFinish) }))

describe('First-login onboarding /customer/setup (W05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    axiosMock.get.mockReset()
    axiosMock.patch.mockReset()
    axiosMock.get.mockImplementation(async () => ({ data: { result: [CHURCH] } }))
    axiosMock.patch.mockResolvedValue({ data: resolveGet({ id: 'u1' }) })
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })
  })

  it('starts on the parish step (1 of 2), marked optional', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.setupTitle })).toBeTruthy()
    expect(screen.getByText('Form 1 of 2')).toBeTruthy()
    expect(screen.getByText(en.signUpOptional)).toBeTruthy()
  })

  it('saves the parish on step 1 and language on step 2, then goes home', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: CHURCH.name }))
    await next()
    expect(await screen.findByText('Form 2 of 2')).toBeTruthy()
    expect(axiosMock.patch).toHaveBeenNthCalledWith(1, '/api/v1/site/me', {
      mainChurchId: 'c1',
    })
    await finish()

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    expect(axiosMock.patch).toHaveBeenNthCalledWith(2, '/api/v1/site/me', {
      locale: 'en',
    })
    expect(JSON.parse(localStorage.getItem('prayer365.setupProgress.u1') ?? '{}')).toEqual({
      churchStepDone: true,
      localeStepDone: true,
      completed: true,
    })
  })

  it('without a parish: saves the empty choice before saving language', async () => {
    renderPage()
    await next()
    expect(axiosMock.patch).toHaveBeenNthCalledWith(1, '/api/v1/site/me', {
      mainChurchId: null,
    })
    await finish()

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    expect(axiosMock.patch).toHaveBeenNthCalledWith(2, '/api/v1/site/me', {
      locale: 'en',
    })
  })

  it('"Skip for now" saves no main church and advances to the language step', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: en.setupSkip }))

    expect(await screen.findByText('Form 2 of 2')).toBeTruthy()
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
      mainChurchId: null,
    })
    expect(pushMock).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('prayer365.setupProgress.u1') ?? '{}')).toMatchObject({
      churchStepDone: false,
      completed: false,
    })
  })

  it('shows a general error and stays on the church step when its save fails', async () => {
    axiosMock.patch.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await next()

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
    expect(screen.getByText('Form 1 of 2')).toBeTruthy()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('resumes the unfinished language step', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <ContentsSiteSetup initialMe={ME} locale="en" initialStep={2} />
      </SiteI18nProvider>,
    )

    expect(screen.getByText('Form 2 of 2')).toBeTruthy()
    expect(screen.getByLabelText(en.signUpLanguageLabel)).toBeTruthy()
  })

  it('skipping language saves the default locale, unfilled, and leaves setup', async () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="et">
        <ContentsSiteSetup initialMe={ME} locale="et" initialStep={2} />
      </SiteI18nProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: SITE_MESSAGES.et.setupSkip }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', {
      locale: 'en',
      localeSkipped: true,
    })
  })
})
