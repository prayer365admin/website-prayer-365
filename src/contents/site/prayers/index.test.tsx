import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SitePrayerArchive, SitePrayerArchiveQuery } from '@/models/site-prayer'
import { pushMock, renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrayerArchive from '.'

vi.mock('@/components/site/prayer/devotional-audio-player', () => ({
  default: ({ prayerId }: { prayerId: string }) => <div>Audio player {prayerId}</div>,
}))

const prayer = (id: string, audio: boolean) => ({
  id,
  churchId: 'church-1',
  churchName: 'Hope Church',
  publishedAt: '2026-10-15T06:00:00.000Z',
  pastorId: 'pastor-1',
  pastorName: 'Pastor Daniel',
  pastorBio: null,
  pastorRole: 'Lead pastor',
  pastorImageUrl: null,
  title: id === 'featured' ? 'Peace in uncertain times' : 'Morning gratitude',
  introduction: 'A reflection for today',
  body: 'Do not be anxious about anything; bring every request in prayer.',
  languageCode: 'en',
  audio: audio
    ? { prayerAudioId: 'audio-1', url: 'https://cdn.test/prayer.mp3', approvedAt: '' }
    : null,
})

const query: SitePrayerArchiveQuery = {
  page: 1,
  limit: 6,
  search: '',
  churchId: '',
  language: '',
  format: 'all',
}

const renderArchive = (archive: SitePrayerArchive) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PrayerArchive archive={archive} query={query} />
    </SiteI18nProvider>,
  )

describe('PrayerArchive', () => {
  it('renders the repository, filters, featured audio, grid, summary, and archive banner', () => {
    renderArchive({
      result: [prayer('grid-1', false)],
      featured: prayer('featured', true),
      total: 1,
      page: 1,
      limit: 6,
      totalPages: 1,
      churches: [{ value: 'church-1', label: 'Hope Church' }],
      languages: ['en'],
    })

    expect(screen.getByRole('heading', { name: /Daily Prayers/ })).toBeTruthy()
    expect(screen.getByText("Today's Guided Meditation")).toBeTruthy()
    expect(screen.getByText('Audio player featured')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Curated Liturgies & Prayers' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Morning gratitude' })).toBeTruthy()
    expect(screen.getByText('14,820 Believers Praying Today')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'Request Pastoral Intercession' }).getAttribute('href'),
    ).toBe('/#prayer-petition')
    expect(screen.getByRole('heading', { name: /Ecumenical Lectionary Cycle/ })).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: 'View Prayer & Details' })[0].getAttribute('href'),
    ).toBe('/prayers/featured')
  })

  it('renders the honest no-fellowship state', () => {
    renderArchive({
      result: [],
      featured: null,
      total: 0,
      page: 1,
      limit: 6,
      totalPages: 1,
      churches: [],
      languages: [],
    })

    expect(screen.getByRole('heading', { name: 'Build your fellowship first' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open profile' }).getAttribute('href')).toBe(
      '/customer',
    )
  })

  it('applies a filter by navigating to page 1 of the filtered URL', () => {
    renderArchive({
      result: [prayer('grid-1', false)],
      featured: null,
      total: 1,
      page: 1,
      limit: 6,
      totalPages: 1,
      churches: [{ value: 'church-1', label: 'Hope Church' }],
      languages: ['en'],
    })

    fireEvent.mouseDown(screen.getByLabelText('Format'))
    fireEvent.click(screen.getByText('Audio'))

    expect(pushMock).toHaveBeenCalledWith('/prayers?format=audio')
  })

  it('clears a filter back to all results', () => {
    renderWithProviders(
      <SiteI18nProvider initialLocale="en">
        <PrayerArchive
          archive={{
            result: [],
            featured: null,
            total: 0,
            page: 1,
            limit: 6,
            totalPages: 1,
            churches: [{ value: 'church-1', label: 'Hope Church' }],
            languages: ['en'],
          }}
          query={{ ...query, churchId: 'church-1', format: 'audio' }}
        />
      </SiteI18nProvider>,
    )

    const clear = document.querySelectorAll('.ant-select-clear')
    expect(clear).toHaveLength(2) // church + format; language and duration have no value
    fireEvent.click(clear[1])

    expect(pushMock).toHaveBeenCalledWith('/prayers?churchId=church-1')
  })

  it('renders text-only prayers without any audio player', () => {
    renderArchive({
      result: [prayer('grid-1', false)],
      featured: null,
      total: 1,
      page: 1,
      limit: 6,
      totalPages: 1,
      churches: [{ value: 'church-1', label: 'Hope Church' }],
      languages: ['en'],
    })

    expect(screen.queryByText(/Audio player/)).toBeNull()
    expect(screen.getAllByText(/Text prayer/).length).toBeGreaterThan(0)
  })
})
