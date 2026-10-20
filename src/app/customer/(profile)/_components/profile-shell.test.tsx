import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProfileShell from './profile-shell'

const m = vi.hoisted(() => ({
  signOut: vi.fn(),
}))

vi.mock('next-auth/react', () => ({ signOut: m.signOut }))
vi.mock('next/navigation', () => ({ usePathname: () => '/customer' }))

describe('ProfileShell', () => {
  beforeEach(() => {
    m.signOut.mockReset()
  })

  it('shows a loading state while signing out and orders the button after the content', () => {
    m.signOut.mockReturnValue(new Promise(() => undefined))
    const { container } = render(
      <ProfileShell>
        <div data-testid="profile-content">Profile content</div>
      </ProfileShell>,
    )
    const button = screen.getByRole('button', { name: 'Sign Out from Prayer 365' })
    const content = screen.getByTestId('profile-content').parentElement!

    expect(container.querySelector('aside')?.contains(button)).toBe(false)
    expect(content.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(button)

    expect(m.signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button).toHaveProperty('disabled', true)
  })
})
