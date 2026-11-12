import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listPublicChurches, requiredWebAuth } = vi.hoisted(() => ({
  listPublicChurches: vi.fn(),
  requiredWebAuth: vi.fn(),
}))

vi.mock('@/controller/mobile', () => ({ listPublicChurches }))
vi.mock('@/utils/required-webauth', () => ({ default: requiredWebAuth }))
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: vi.fn().mockResolvedValue('en') }))
vi.mock('@/contents/site/church-directory', () => ({
  default: () => <div data-testid="church-directory">Church Directory</div>,
}))

describe('Churches Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicChurches.mockResolvedValue({ result: [], total: 0 })
    requiredWebAuth.mockResolvedValue({ session: { user: { user_id: 'u1' } } })
  })

  it('renders ContentsSiteChurchDirectory for a signed-in member', async () => {
    const Page = (await import('./page')).default
    const { getByTestId } = render(await Page())

    expect(getByTestId('church-directory')).toBeTruthy()
  })

  it('sends a guest to /welcome and asks crawlers not to index the list', async () => {
    requiredWebAuth.mockRejectedValue(new Error('no session'))
    const { default: Page, metadata } = await import('./page')

    await expect(Page()).rejects.toThrow(/NEXT_REDIRECT/)
    expect(metadata.robots).toMatchObject({ index: false, follow: false })
  })
})
