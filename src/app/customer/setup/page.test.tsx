import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Page from './page'

const m = vi.hoisted(() => ({
  requiredWebAuth: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`)
  }),
  getMe: vi.fn(),
  getSetupProgress: vi.fn(),
}))

vi.mock('@/utils/required-webauth', () => ({ default: m.requiredWebAuth }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('@/controller/mobile', () => ({ getMe: m.getMe }))
vi.mock('@/controller/site', () => ({ getSetupProgress: m.getSetupProgress }))
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: () => 'en' }))
vi.mock('@/contents/site/setup', () => ({
  default: ({ initialStep }: { initialStep: number }) => <div>Setup step {initialStep}</div>,
}))

describe('/customer/setup page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('redirects unauthenticated visitors before loading setup data', async () => {
    m.requiredWebAuth.mockRejectedValue(new Error('UNAUTHORIZED'))

    await expect(Page()).rejects.toThrow('REDIRECT /login')
    expect(m.getSetupProgress).not.toHaveBeenCalled()
  })

  it('starts at the church step when the parish step was never answered', async () => {
    m.getSetupProgress.mockResolvedValue({ churchStepDone: false, completed: false })
    m.getMe.mockResolvedValue({ id: 'u1', locale: null, mainChurchId: null })

    render(await Page())

    expect(screen.getByText('Setup step 1')).toBeTruthy()
  })

  it('resumes the language step from the account (any browser) after church saved or skipped', async () => {
    m.getSetupProgress.mockResolvedValue({ churchStepDone: true, completed: false })
    m.getMe.mockResolvedValue({ id: 'u1', locale: null, mainChurchId: null })

    render(await Page())

    expect(screen.getByText('Setup step 2')).toBeTruthy()
  })

  it('redirects a customer who finished onboarding (both steps saved) to /customer', async () => {
    m.getSetupProgress.mockResolvedValue({ churchStepDone: true, completed: true })

    await expect(Page()).rejects.toThrow('REDIRECT /customer')
    expect(m.getSetupProgress).toHaveBeenCalledWith({ userId: 'u1' })
  })
})
