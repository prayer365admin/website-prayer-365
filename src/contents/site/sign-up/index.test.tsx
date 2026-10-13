import { SITE_MESSAGES } from '@/i18n/messages'
import { SiteI18nProvider } from '@/i18n/site-i18n'
import { axiosMock, pushMock, renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsSiteSignUp from '.'

const en = SITE_MESSAGES.en
const CHURCH = { id: 'c1', name: 'Tallinna Jaani', city: 'Tallinn' }

const renderPage = () =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteSignUp locale="en" />
    </SiteI18nProvider>,
  )

const next = () => userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpNext) }))

const fillStep1 = async () => {
  await userEvent.type(screen.getByLabelText(en.signUpNameLabel), ' Maria Lindqvist ')
  await userEvent.type(screen.getByLabelText(en.signUpEmailLabel), 'maria@example.com')
  await userEvent.type(screen.getByLabelText(en.signUpPasswordLabel), 'Password1!')
}

const toStep3 = async () => {
  await fillStep1()
  await next()
  await userEvent.click(await screen.findByRole('button', { name: CHURCH.name }))
  await next()
  await screen.findByText(en.signUpStep3Title)
}

const axiosError = (error_code: string) =>
  Object.assign(new Error('Request failed'), {
    isAxiosError: true,
    response: { data: { error_code } },
  })

describe('Customer sign-up wizard (W02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockReset()
    axiosMock.post.mockReset()
    axiosMock.get.mockImplementation(async () => ({ data: { result: [CHURCH] } }))
  })

  it('starts on step 1 of 3 with the aside and footer', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: en.signUpTitle })).toBeTruthy()
    expect(screen.getByText('Form 1 of 3')).toBeTruthy()
    expect(screen.getByText(en.journeyTitle)).toBeTruthy()
    expect(screen.getByRole('link', { name: en.signUpSignIn }).getAttribute('href')).toBe('/login')
  })

  it('Next validates only step 1 and blocks on empty fields', async () => {
    renderPage()
    await next()

    expect(await screen.findByText(en.signUpErrorName)).toBeTruthy()
    expect(screen.getByText('Form 1 of 3')).toBeTruthy()
  })

  it('rejects a password shorter than 8 characters', async () => {
    renderPage()
    await userEvent.type(screen.getByLabelText(en.signUpNameLabel), 'Maria')
    await userEvent.type(screen.getByLabelText(en.signUpEmailLabel), 'maria@example.com')
    await userEvent.type(screen.getByLabelText(en.signUpPasswordLabel), 'short')
    await next()

    expect(await screen.findByText(en.signUpErrorPassword)).toBeTruthy()
  })

  it('keeps step 1 values after going back from step 2', async () => {
    renderPage()
    await fillStep1()
    await next()
    expect(await screen.findByText('Form 2 of 3')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpBack) }))

    expect((screen.getByLabelText(en.signUpEmailLabel) as HTMLInputElement).value).toBe(
      'maria@example.com',
    )
  })

  it('parish is optional: Next works without one, and a frequent chip selects one', async () => {
    renderPage()
    await fillStep1()
    await next()
    await next()
    expect(await screen.findByText('Form 3 of 3')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpBack) }))
    const chip = await screen.findByRole('button', { name: CHURCH.name })
    await userEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
  })

  it('signs up without a parish (no main_church_id sent)', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { id: 'u1', email: 'maria@example.com', name: 'Maria Lindqvist' } },
    })
    renderPage()
    await fillStep1()
    await next()
    await next()
    await screen.findByText(en.signUpStep3Title)
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    expect(await screen.findByText(en.signUpSuccessTitle)).toBeTruthy()
    expect(axiosMock.post.mock.calls[0][1]).not.toHaveProperty('main_church_id', expect.anything())
  })

  it('creates the account once with all steps and shows "check your email"', async () => {
    axiosMock.post.mockResolvedValue({
      data: { result: { id: 'u1', email: 'maria@example.com', name: 'Maria Lindqvist' } },
    })
    renderPage()
    await toStep3()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    expect(await screen.findByText(en.signUpSuccessTitle)).toBeTruthy()
    expect(axiosMock.post).toHaveBeenCalledTimes(1)
    expect(axiosMock.post).toHaveBeenCalledWith('/api/v1/auth/signup', {
      full_name: 'Maria Lindqvist',
      email: 'maria@example.com',
      password: 'Password1!',
      confirm_password: 'Password1!',
      locale: 'en',
      main_church_id: 'c1',
    })
    expect(screen.getByText(/maria@example\.com/)).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: en.signUpSuccessAction }))
    expect(pushMock).toHaveBeenCalledWith('/login')
  })

  it('locks the form (fields, checkboxes, Back) while the account is being created', async () => {
    let resolve!: (v: unknown) => void
    axiosMock.post.mockReturnValue(new Promise((r) => (resolve = r)))
    renderPage()
    await toStep3()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: new RegExp(en.signUpBack) })).toHaveProperty(
        'disabled',
        true,
      ),
    )
    expect(screen.getAllByRole('checkbox').every((c) => (c as HTMLInputElement).disabled)).toBe(
      true,
    )
    expect(screen.getByRole('combobox')).toHaveProperty('disabled', true)

    resolve({ data: { result: { id: 'u1', email: 'maria@example.com', name: 'Maria' } } })
    expect(await screen.findByText(en.signUpSuccessTitle)).toBeTruthy()
  })

  it('a taken email sends the user back to step 1 with the error on the email field', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('USER_EXISTS'))
    renderPage()
    await toStep3()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    expect(await screen.findByText(en.signUpErrorExists)).toBeTruthy()
    expect(screen.getByText('Form 1 of 3')).toBeTruthy()
  })

  it('an error on a step-3 field shows on step 3', async () => {
    axiosMock.post.mockRejectedValueOnce(axiosError('INVALID_LOCALE'))
    renderPage()
    await toStep3()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    expect(await screen.findByText(en.signUpErrorLocale)).toBeTruthy()
    expect(screen.getByText('Form 3 of 3')).toBeTruthy()
  })

  it('shows a general error when signup fails without a field', async () => {
    axiosMock.post.mockRejectedValueOnce(new Error('network down'))
    renderPage()
    await toStep3()
    await userEvent.click(screen.getByRole('button', { name: new RegExp(en.signUpSubmit) }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en.error))
  })
})
