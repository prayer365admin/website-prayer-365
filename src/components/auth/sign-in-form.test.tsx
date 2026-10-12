import { pushMock, renderWithProviders, signInMock } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignInForm from './sign-in-form'

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

  it('redirects to the target after a successful sign-in', async () => {
    renderWithProviders(
      <SignInForm brandTitle="Dashboard" welcome="Welcome" redirectTo="/dashboard" />,
    )
    await userEvent.type(screen.getByPlaceholderText('Email'), 'a@b.c')
    await userEvent.type(screen.getByPlaceholderText('Password'), 'Secret@123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(pushMock).toHaveBeenCalledWith('/dashboard')
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
