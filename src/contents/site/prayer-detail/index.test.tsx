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
  slug: `${id}-slug`,
  churchId: 'church-1',
  churchName: 'Hope Church',
  churchCoverUrl: 'https://cdn.test/hope-church-cover.jpg',
  featuredImageUrl: null,
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
    ? {
        prayerAudioId: 'audio-1',
        url: 'https://cdn.test/prayer.mp3',
        approvedAt: '',
        durationSeconds: 125,
      }
    : null,
})

const detail: SitePrayerDetail = {
  prayer: item('prayer-1', 'Peace in Uncertain Times', true),
  church: {
    id: 'church-1',
    slug: 'hope-church',
    name: 'Hope Church',
    city: 'Tallinn',
    phone: '+372 123 4567',
    imageUrl: '/images/dynamic-prayer.jpg',
  },
  related: [item('prayer-2', 'Resting in the Shadow', false)],
}

const renderDetail = (data = detail) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PrayerDetail detail={data} userId="u1" />
    </SiteI18nProvider>,
  )

describe('PrayerDetail', () => {
  it('renders the reader: title, attribution, sections, paragraphs, and audio without a transcript link', () => {
    renderDetail()

    expect(screen.getByRole('heading', { level: 1, name: 'Peace in Uncertain Times' })).toBeTruthy()
    expect(screen.getByText(/Led by Daniel Mäkinen, Hope Church/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Introductions/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^2\s*Prayer$/ })).toBeTruthy()
    expect(screen.getByText('Do not be anxious.')).toBeTruthy()
    expect(screen.getByText('Bring every request in prayer.')).toBeTruthy()
    expect(screen.getAllByText('Peace in Uncertain Times').length).toBeGreaterThan(1)
    expect(
      screen
        .getByRole('img', { name: 'Peace in Uncertain Times' })
        .getAttribute('src')
        ?.includes('dynamic-prayer.jpg'),
    ).toBe(true)
    expect(screen.getByText('Audio player without transcript')).toBeTruthy()
    expect(screen.getByText(/Audio prayer · 3 min/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /View: Hope Church \(Tallinn\)/ }).getAttribute('href'),
    ).toBe('/churches/hope-church')
    expect(screen.queryByLabelText('Saving prayers is not available yet')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Liturgical Context' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Related Prayers by Churches' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Resting in the Shadow/ }).getAttribute('href')).toBe(
      '/prayers/prayer-2-slug',
    )
    expect(screen.getByRole('link', { name: '+372 123 4567' }).getAttribute('href')).toBe(
      'tel:+3721234567',
    )
    expect(screen.getByRole('heading', { name: 'Donations / Stewardship' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Donate/ }).getAttribute('href')).toBe(
      '/donate?church=hope-church',
    )
  })

  it('numbers sections from 1 when there is no introduction and shows text-only prayers without a player', () => {
    renderDetail({
      ...detail,
      prayer: { ...item('prayer-1', 'Evening Peace', false), introduction: null },
      church: { ...detail.church, imageUrl: null, phone: null },
      related: [],
    })

    expect(screen.queryByRole('heading', { name: /Introductions/ })).toBeNull()
    expect(screen.getByRole('heading', { name: /1\s*Prayer/ })).toBeTruthy()
    expect(
      screen
        .getByRole('img', { name: 'Evening Peace' })
        .getAttribute('src')
        ?.includes('church.jpg'),
    ).toBe(true)
    expect(screen.queryByText(/Audio player/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Related Prayers by Churches' })).toBeNull()
    expect(screen.queryByText('Church phone number')).toBeNull()
  })

  it('renders introduction rich text on the prayer detail page', () => {
    renderDetail({
      ...detail,
      prayer: {
        ...detail.prayer,
        introduction:
          '<p>Take\u00a0a\u00a0<strong>quiet\u00a0breath</strong>.</p><blockquote>Be\u00a0still.</blockquote>',
        body: '<p>Truth\u00a0and\u00a0love.</p>',
      },
    })

    const section = screen.getByRole('heading', { name: /Introductions/ }).closest('section')
    expect(section?.querySelector('strong')?.textContent).toBe('quiet breath')
    expect(section?.querySelector('blockquote')?.textContent).toBe('Be still.')
    expect(section?.textContent).not.toContain('\u00a0')
    expect(screen.getAllByText('Truth and love.').length).toBeGreaterThanOrEqual(2)
  })

  it('never exposes ElevenLabs cues in the prayer reader', () => {
    renderDetail({
      ...detail,
      prayer: {
        ...detail.prayer,
        title: '[calm] Peace in Uncertain Times',
        introduction: '<p>[warm] Take a <strong>quiet breath</strong>.</p>',
        body: '<p>[softly] Do not be anxious.</p><p>[pause] Bring every request in prayer.</p>',
      },
      related: [{ ...detail.related[0]!, title: '[gentle] Resting in the Shadow' }],
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Peace in Uncertain Times' })).toBeTruthy()
    expect(screen.getAllByText('Take a ', { exact: false }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Do not be anxious.')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Resting in the Shadow/ })).toBeTruthy()
    expect(screen.queryByText(/\[(?:calm|warm|softly|pause|gentle)\]/i)).toBeNull()
  })
})
