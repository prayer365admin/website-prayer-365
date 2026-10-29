import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSitePrayerDetail: vi.fn(),
  requiredWebAuth: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/controller/site-prayer', () => ({
  getSitePrayerDetail: mocks.getSitePrayerDetail,
}))
vi.mock('@/utils/required-webauth', () => ({
  default: mocks.requiredWebAuth,
}))
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))
vi.mock('@/contents/site/prayer-detail', () => ({
  default: ({ detail }: { detail: { prayer: { slug: string } } }) => (
    <div>Prayer detail {detail.prayer.slug}</div>
  ),
}))

import PrayerDetailPage from './page'

const detail = {
  prayer: { slug: 'peace-in-uncertain-times' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requiredWebAuth.mockResolvedValue({
    session: { user: { user_id: 'user-1' } },
  })
  mocks.redirect.mockImplementation((href: string) => {
    throw new Error(`redirect:${href}`)
  })
  mocks.notFound.mockImplementation(() => {
    throw new Error('not-found')
  })
})

describe('PrayerDetailPage', () => {
  it('loads a prayer by its slug', async () => {
    mocks.getSitePrayerDetail.mockResolvedValue(detail)

    render(
      await PrayerDetailPage({
        params: Promise.resolve({ slug: 'peace-in-uncertain-times' }),
      }),
    )

    expect(mocks.getSitePrayerDetail).toHaveBeenCalledWith({
      prayerSlug: 'peace-in-uncertain-times',
    })
    expect(screen.getByText('Prayer detail peace-in-uncertain-times')).toBeTruthy()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('redirects a legacy prayer ID to its canonical slug URL', async () => {
    mocks.getSitePrayerDetail.mockResolvedValue(detail)

    await expect(
      PrayerDetailPage({ params: Promise.resolve({ slug: 'legacy-prayer-id' }) }),
    ).rejects.toThrow('redirect:/prayers/peace-in-uncertain-times')

    expect(mocks.redirect).toHaveBeenCalledWith('/prayers/peace-in-uncertain-times')
  })

  it('returns not found when neither a slug nor legacy ID exists', async () => {
    mocks.getSitePrayerDetail.mockResolvedValue(null)

    await expect(
      PrayerDetailPage({ params: Promise.resolve({ slug: 'missing-prayer' }) }),
    ).rejects.toThrow('not-found')
  })
})
