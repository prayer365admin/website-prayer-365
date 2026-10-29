import { pushMock, renderWithProviders, signInMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsAdminSignIn from '.'
import { REMEMBER_WORKSTATION_STORAGE_KEY } from './form'

const { hardNavigate } = vi.hoisted(() => ({ hardNavigate: vi.fn() }))
// Sign-in ends in a FULL page load (plan 025), never a client navigation.
vi.mock('@/utils/hard-navigate', () => ({ hardNavigate }))

const fillAndSubmit = async (
  email = 'pastor.carter@gracechurchwestminster.org',
  password = 'SecretPassword123',
) => {
  await userEvent.type(screen.getByLabelText(/Official Church \/ Staff Email/i), email)
  await userEvent.type(screen.getByLabelText(/Password/i), password)
  await userEvent.click(screen.getByRole('button', { name: /Sign In to Church Workspace/i }))
}

describe('Admin sign-in contents (design s01)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    signInMock.mockResolvedValue({ error: null, code: null })
  })

  it('renders the designed sign-in screen with hero and auth card elements', () => {
    renderWithProviders(<ContentsAdminSignIn />)

    // Headings
    expect(screen.getByRole('heading', { level: 1, name: 'Prayer 365' })).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sign In to Your Workspace' }),
    ).toBeTruthy()

    // Subtitle & quote
    expect(
      screen.getByText(
        'Enter your diocesan credentials or staff credentials to access your church administration console.',
      ),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Everyday faith. A more connected tomorrow. Faith, People, Places — A Brighter Tomorrow.',
      ),
    ).toBeTruthy()

    // Feature card titles
    expect(screen.getByText('Multi-Tenant Sanctuary Workspace')).toBeTruthy()
    expect(screen.getByText('Diocesan & Central Governance')).toBeTruthy()
    expect(screen.getByText('Private & Protected Pastoral Care')).toBeTruthy()

    // Top bar & footer
    expect(screen.getByText('FAITH · BELONG · GIVE · GROW')).toBeTruthy()
    expect(screen.getByText('Privacy Charter')).toBeTruthy()
    expect(screen.getByText('Safeguarding Standards')).toBeTruthy()

    // Badge
    expect(screen.getByText('Encrypted 256-bit')).toBeTruthy()

    // Form inputs
    expect(screen.getByLabelText(/Official Church \/ Staff Email/i)).toBeTruthy()
    expect(screen.getByLabelText(/Password/i)).toBeTruthy()

    // Unchecked "Remember this workstation" checkbox
    const rememberCheckbox = screen.getByLabelText('Remember this workstation') as HTMLInputElement
    expect(rememberCheckbox.checked).toBe(false)

    // Forgot password link
    const forgotLink = screen.getByRole('link', { name: 'Forgot password?' })
    expect(forgotLink.getAttribute('href')).toBe('/admin/forgot-password')
    // Audit notice
    expect(
      screen.getByText(
        /This system is strictly restricted to authorized clergy, church administrators, and diocesan staff\./i,
      ),
    ).toBeTruthy()
  })

  it('signs in with trimmed email and hardNavigates to /dashboard on success', async () => {
    renderWithProviders(<ContentsAdminSignIn />)

    await fillAndSubmit('  pastor.carter@gracechurchwestminster.org  ', 'ValidPassword123')

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('credentials', {
        name: 'pastor.carter@gracechurchwestminster.org',
        password: 'ValidPassword123',
        redirect: false,
      })
    })

    await waitFor(() => {
      expect(hardNavigate).toHaveBeenCalledWith('/dashboard')
    })
    expect(pushMock).not.toHaveBeenCalled()
  })

  it.each(['INVALID_CREDENTIALS', 'PASSWORD_INVALID', 'USER_NOT_FOUND', 'ACCOUNT_HAS_NO_PASSWORD'])(
    'shows the credentials error message for code %s',
    async (code) => {
      signInMock.mockResolvedValue({ error: 'CredentialsSignin', code })
      renderWithProviders(<ContentsAdminSignIn />)

      await fillAndSubmit()

      const alert = await screen.findByRole('alert')
      expect(alert.textContent).toContain('Please check your email and password, and try again!')
      expect(hardNavigate).not.toHaveBeenCalled()
    },
  )

  it('shows the generic error message for unexpected error codes', async () => {
    signInMock.mockResolvedValue({ error: 'UnknownError', code: 'SERVER_ERROR' })
    renderWithProviders(<ContentsAdminSignIn />)

    await fillAndSubmit()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Sign in failed. Please try again!')
    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('routes to /verify-account with encoded email when EMAIL_NOT_VERIFIED', async () => {
    signInMock.mockResolvedValue({
      error: 'Unverified',
      code: 'EMAIL_NOT_VERIFIED',
    })
    renderWithProviders(<ContentsAdminSignIn />)

    await fillAndSubmit('unverified+test@church.org', 'Secret123')

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/verify-account?email=unverified%2Btest%40church.org')
    })
    expect(hardNavigate).not.toHaveBeenCalled()
  })

  it('requires email and password before calling sign-in', async () => {
    renderWithProviders(<ContentsAdminSignIn />)

    await userEvent.click(screen.getByRole('button', { name: /Sign In to Church Workspace/i }))

    expect(await screen.findByText('Email is required')).toBeTruthy()
    expect(await screen.findByText('Password is required')).toBeTruthy()
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('clears error alert when user types in any field', async () => {
    signInMock.mockResolvedValue({
      error: 'Invalid',
      code: 'INVALID_CREDENTIALS',
    })
    renderWithProviders(<ContentsAdminSignIn />)

    await fillAndSubmit()
    const alert = await screen.findByRole('alert')
    expect(alert).toBeTruthy()

    await userEvent.type(screen.getByLabelText(/Official Church \/ Staff Email/i), 'a')
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('saves email in localStorage when remember workstation is checked', async () => {
    renderWithProviders(<ContentsAdminSignIn />)

    await userEvent.type(
      screen.getByLabelText(/Official Church \/ Staff Email/i),
      'staff@gracechurch.org',
    )
    await userEvent.type(screen.getByLabelText(/Password/i), 'Secret123!')
    await userEvent.click(screen.getByLabelText('Remember this workstation'))
    await userEvent.click(screen.getByRole('button', { name: /Sign In to Church Workspace/i }))

    await waitFor(() => {
      expect(localStorage.getItem(REMEMBER_WORKSTATION_STORAGE_KEY)).toBe('staff@gracechurch.org')
    })
  })

  it('removes email from localStorage when remember workstation is not checked', async () => {
    localStorage.setItem(REMEMBER_WORKSTATION_STORAGE_KEY, 'old@gracechurch.org')
    renderWithProviders(<ContentsAdminSignIn />)

    // It was prefilled and checked; uncheck it
    const rememberCheckbox = screen.getByLabelText('Remember this workstation') as HTMLInputElement
    await waitFor(() => {
      expect(rememberCheckbox.checked).toBe(true)
    })
    await userEvent.click(rememberCheckbox)
    await userEvent.type(screen.getByLabelText(/Password/i), 'Secret123!')
    await userEvent.click(screen.getByRole('button', { name: /Sign In to Church Workspace/i }))

    await waitFor(() => {
      expect(localStorage.getItem(REMEMBER_WORKSTATION_STORAGE_KEY)).toBeNull()
    })
  })

  it('prefills email and checks remember box on mount when saved in localStorage', async () => {
    localStorage.setItem(REMEMBER_WORKSTATION_STORAGE_KEY, 'saved.staff@church.org')
    renderWithProviders(<ContentsAdminSignIn />)

    const emailInput = screen.getByLabelText(/Official Church \/ Staff Email/i) as HTMLInputElement
    const rememberCheckbox = screen.getByLabelText('Remember this workstation') as HTMLInputElement

    await waitFor(() => {
      expect(emailInput.value).toBe('saved.staff@church.org')
      expect(rememberCheckbox.checked).toBe(true)
    })
  })
})
