import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SitePrayerDetail } from '@/models/site-prayer'
import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PrayerDetail from '.'

vi.mock('@/components/site/prayer/devotional-audio-player', () => ({
  default: ({ showTranscript }: { showTranscript?: boolean }) => (
    <div>Audio player {showTranscript ? 'with transcript' : 'without transcript'}</div>
  ),
}))

const item = (id: string, title: string, audio: boolean) => ({
  id,
  churchId: 'church-1',
  churchName: 'Hope Church',
  publishedAt: '2026-10-15T06:00:00.000Z',
  pastorId: 'pastor-1',
  pastorName: 'Daniel Mäkinen',
  pastorBio: 'Served Baltic congregations for 15 years.',
  pastorRole: 'Lead Pastor',
  pastorImageUrl: null,
  title,
  introduction: 'Take a quiet breath.',
  body: 'Do not be anxious.\n\nBring every request in prayer.',
  languageCode: 'en',
  audio: audio
    ? { prayerAudioId: 'audio-1', url: 'https://cdn.test/prayer.mp3', approvedAt: '' }
    : null,
})

const detail: SitePrayerDetail = {
  prayer: item('prayer-1', 'Peace in Uncertain Times', true),
  church: { id: 'church-1', name: 'Hope Church', city: 'Tallinn' },
  related: [item('prayer-2', 'Resting in the Shadow', false)],
}

const renderDetail = (data = detail) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PrayerDetail detail={data} />
    </SiteI18nProvider>,
  )

describe('PrayerDetail', () => {
  it('renders the reader: title, attribution, sections, paragraphs, and audio without a transcript link', () => {
    renderDetail()

    expect(screen.getByRole('heading', { level: 1, name: 'Peace in Uncertain Times' })).toBeTruthy()
    expect(screen.getByText(/Led by Daniel Mäkinen, Hope Church/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Opening Invocation/ })).toBeTruthy()
    expect(screen.getByText('Do not be anxious.')).toBeTruthy()
    expect(screen.getByText('Bring every request in prayer.')).toBeTruthy()
    expect(screen.getByText('Audio player without transcript')).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /View: Hope Church \(Tallinn\)/ }).getAttribute('href'),
    ).toBe('/churches/church-1')
    expect(screen.queryByLabelText('Saving prayers is not available yet')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Liturgical Context' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Devotionals in this Arc' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Resting in the Shadow/ })).toBeNull()
  })

  it('numbers sections from 1 when there is no introduction and shows text-only prayers without a player', () => {
    renderDetail({
      ...detail,
      prayer: { ...item('prayer-1', 'Evening Peace', false), introduction: null },
      related: [],
    })

    expect(screen.queryByRole('heading', { name: /Opening Invocation/ })).toBeNull()
    expect(screen.getByRole('heading', { name: /1\s*Scripture Meditation/ })).toBeTruthy()
    expect(screen.queryByText(/Audio player/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Devotionals in this Arc' })).toBeNull()
  })
})
