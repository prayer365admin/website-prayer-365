import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listPublicChurches } = vi.hoisted(() => ({ listPublicChurches: vi.fn() }))

vi.mock('@/controller/mobile', () => ({ listPublicChurches }))
vi.mock('@/utils/site-locale', () => ({ getSiteLocale: vi.fn().mockResolvedValue('en') }))
vi.mock('@/contents/site/church-directory', () => ({
  default: () => <div data-testid="church-directory">Church Directory</div>,
}))

describe('Churches Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPublicChurches.mockResolvedValue({ result: [], total: 0 })
  })

  it('renders ContentsSiteChurchDirectory', async () => {
    const Page = (await import('./page')).default
    const { getByTestId } = render(await Page())

    expect(getByTestId('church-directory')).toBeTruthy()
  })
})
