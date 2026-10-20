import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  getMe: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/controller/mobile', () => ({
  getMe: m.getMe,
}))
vi.mock('./_components/personal-profile', () => ({
  default: ({
    emailVerified,
    initialMe,
  }: {
    emailVerified: boolean
    initialMe: { name: string }
  }) => (
    <div>
      Server profile: {initialMe.name}; verified: {String(emailVerified)}
    </div>
  ),
}))

describe('/customer page server guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects before reading or rendering profile data when unauthenticated', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(Page()).rejects.toThrow('REDIRECT /login')
    expect(m.getMe).not.toHaveBeenCalled()
  })

  it('passes server-loaded customer data to the client profile', async () => {
    m.requiredWebAuth.mockResolvedValue({
      session: { user: { user_id: 'u1' } },
      user: { email_verified_at: new Date('2024-10-01T00:00:00.000Z') },
    })
    m.getMe.mockResolvedValue({ id: 'u1', name: 'Maria', locale: 'en', mainChurchId: 'c1' })

    render(await Page())

    expect(screen.getByText('Server profile: Maria; verified: true')).toBeTruthy()
    expect(m.getMe).toHaveBeenCalledWith({ userId: 'u1' })
  })
})
