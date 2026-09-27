import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const pushMock = vi.fn()
const signInMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}))

import ContentsLogin from './index'

function renderLogin() {
  return render(
    <App>
      <ContentsLogin />
    </App>,
  )
}

describe('ContentsLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    signInMock.mockResolvedValue({ error: undefined, code: undefined })
  })

  it('renders login form', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Login' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Username')).toBeTruthy()
    expect(screen.getByPlaceholderText('Password')).toBeTruthy()
    expect(screen.getByRole('button', { name: /login/i })).toBeTruthy()
  })

  it('redirects to verify-account when EMAIL_NOT_VERIFIED', async () => {
    signInMock.mockResolvedValue({ error: 'EMAIL_NOT_VERIFIED', code: 'EMAIL_NOT_VERIFIED' })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('Username'), 'user@x.com')
    await user.type(screen.getByPlaceholderText('Password'), 'Strong@123')
    await user.click(screen.getByRole('button', { name: /login/i }))
    expect(pushMock).toHaveBeenCalledWith('/verify-account?email=user%40x.com')
  })

  it('shows notification on generic sign-in error', async () => {
    signInMock.mockResolvedValue({ error: 'CredentialsSignin', code: undefined })
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByPlaceholderText('Username'), 'user@x.com')
    await user.type(screen.getByPlaceholderText('Password'), 'Strong@123')
    await user.click(screen.getByRole('button', { name: /login/i }))
    expect(await screen.findByText('User Not Found!')).toBeTruthy()
  })
})
