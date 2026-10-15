import { SiteI18nProvider } from '@/i18n/site-i18n'
import { MobileHome } from '@/models/mobile'
import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ContentsSiteHome from '.'

const home = (audioUrl: string | null = null): MobileHome => ({
  mainChurch: null,
  followedChurches: [],
  latestEvents: [],
  latestAnnouncements: [],
  latestPrayers: [
    {
      id: 'prayer-1',
      churchId: 'church-1',
      churchName: 'Hope Church',
      publishedAt: '2026-10-15T06:00:00.000Z',
      version: {
        prayerVersionId: 'version-1',
        versionNumber: 1,
        pastorId: 'pastor-1',
        pastorName: 'Daniel Mäkinen',
        title: 'Peace in uncertain times',
        introduction: 'A reflection for today',
        body: 'Do not be anxious about anything.',
        languageCode: 'en',
      },
      audio: audioUrl
        ? {
            prayerAudioId: 'audio-1',
            assetId: 'asset-1',
            assetKey: 'audio/prayer.mp3',
            url: audioUrl,
            approvedAt: '2026-10-15T05:00:00.000Z',
          }
        : null,
    },
  ],
})

const renderHome = (data: MobileHome) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <ContentsSiteHome home={data} name="Anna Example" now="2026-10-15T08:00:00.000Z" />
    </SiteI18nProvider>,
  )

describe('WB3 Home devotional hero', () => {
  it('renders live prayer attribution and a text-only action without approved audio', () => {
    renderHome(home())

    expect(screen.getByRole('heading', { name: /Good morning, Anna/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Peace in uncertain times' })).toBeTruthy()
    expect(screen.getByText('Daniel Mäkinen')).toBeTruthy()
    expect(screen.getAllByText('Hope Church').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Read prayer' }).getAttribute('href')).toBe(
      '/prayers/prayer-1',
    )
    expect(screen.queryByRole('button', { name: 'Play prayer audio' })).toBeNull()
  })

  it('shows the functional player only when approved audio has a public URL', () => {
    const { container } = renderHome(home('https://cdn.example.com/audio/prayer.mp3'))

    expect(screen.getByRole('button', { name: 'Play prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Download prayer audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Read transcript/i }).getAttribute('href')).toBe(
      '/prayers/prayer-1',
    )

    const audio = container.querySelector('audio') as HTMLAudioElement
    Object.defineProperty(audio, 'duration', { configurable: true, value: 328 })
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: 164, writable: true })
    fireEvent.loadedMetadata(audio)
    fireEvent.timeUpdate(audio)

    expect(screen.getByText('5:28')).toBeTruthy()
    expect(screen.getByTestId('audio-progress').getAttribute('style')).toContain('width: 50%')
  })

  it('renders the directory empty state when no eligible prayer exists', () => {
    renderHome({ ...home(), latestPrayers: [] })

    expect(screen.getByRole('heading', { name: 'No prayers yet from your churches' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to church directory' }).getAttribute('href')).toBe(
      '/churches',
    )
  })
})
