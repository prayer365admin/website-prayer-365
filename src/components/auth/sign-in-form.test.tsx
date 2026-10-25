import { pushMock, renderWithProviders, signInMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignInForm from './sign-in-form'

const { hardNavigate } = vi.hoisted(() => ({ hardNavigate: vi.fn() }))
// Sign-in ends in a FULL page load (plan 025), never a client navigation.
vi.mock('@/utils/hard-navigate', () => ({ hardNavigate }))

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInMock.mockResolvedValue({ error: undefined, code: undefined })
  })

  it('renders the brand title and sign-in fields', () => {
    renderWithProviders(<SignInForm brandTitle="PRAYER" welcome="Welcome" redirectTo="/" />)

    expect(screen.getByRole('heading', { name: 'PRAYER' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Email')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
  })

  it('loads the target document after a successful sign-in', async () => {
    renderWithProviders(
      <SignInForm brandTitle="Dashboard" welcome="Welcome" redirectTo="/dashboard" />,
    )
    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.c')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'Secret@123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(hardNavigate).toHaveBeenCalledWith('/dashboard')
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('sends unverified users to the verify page', async () => {
    signInMock.mockResolvedValue({ error: 'x', code: 'EMAIL_NOT_VERIFIED' })
    renderWithProviders(<SignInForm brandTitle="PRAYER" welcome="Welcome" redirectTo="/" />)
    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.c')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'Secret@123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(pushMock).toHaveBeenCalledWith('/verify-account?email=a%40b.c')
  })
})
