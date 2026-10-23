import { SiteI18nProvider } from '@/i18n/site-i18n'
import { SitePrayerArchive, SitePrayerArchiveQuery } from '@/models/site-prayer'
import { axiosMock, renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrayerArchive from '.'

vi.mock('@/components/site/prayer/devotional-audio-player', () => ({
  default: ({ prayerId }: { prayerId: string }) => <div>Audio player {prayerId}</div>,
}))

const prayer = (id: string, audio: boolean, title = 'Morning gratitude') => ({
  id,
  slug: `${id}-slug`,
  churchId: 'church-1',
  churchName: 'Hope Church',
  publishedAt: '2026-10-15T06:00:00.000Z',
  pastorId: 'pastor-1',
  pastorName: 'Pastor Daniel',
  pastorBio: null,
  pastorRole: 'Lead pastor',
  pastorImageUrl: null,
  title,
  introduction: 'A reflection for today',
  body: 'Do not be anxious about anything; bring every request in prayer.',
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

const initialQuery: SitePrayerArchiveQuery = {
  page: 1,
  limit: 6,
  search: '',
  churchId: 'church-1',
  language: '',
  duration: 'all',
  format: 'all',
}

const archive = (
  result: SitePrayerArchive['result'],
  overrides: Partial<SitePrayerArchive> = {},
): SitePrayerArchive => ({
  result,
  featured: prayer('featured', true, 'Peace in uncertain times'),
  total: result.length,
  page: 1,
  limit: 6,
  totalPages: 1,
  churches: [{ value: 'church-1', label: 'Hope Church' }],
  languages: ['en', 'et'],
  selectedChurchId: 'church-1',
  selectedChurchName: 'Hope Church',
  ...overrides,
})

const renderArchive = (value: SitePrayerArchive) =>
  renderWithProviders(
    <SiteI18nProvider initialLocale="en">
      <PrayerArchive archive={value} initialQuery={initialQuery} userId="u1" />
    </SiteI18nProvider>,
  )

const respondWith = (value: SitePrayerArchive) =>
  axiosMock.get.mockResolvedValue({ data: { result: value } })

describe('PrayerArchive', () => {
  beforeEach(() => {
    axiosMock.get.mockReset()
  })

  it('renders the compact header, three filters, latest prayer, and stewardship callout', () => {
    renderArchive(archive([prayer('grid-1', false)]))

    expect(screen.getByRole('heading', { name: /Daily Prayers/ })).toBeTruthy()
    expect(screen.getAllByText('Hope Church').length).toBeGreaterThan(0)
    expect(screen.getByText('Latest Prayer')).toBeTruthy()
    expect(screen.getByText('Audio player featured')).toBeTruthy()
    expect(screen.getByLabelText('Language')).toBeTruthy()
    expect(screen.getByLabelText('Duration')).toBeTruthy()
    expect(screen.getByLabelText('Format')).toBeTruthy()
    expect(screen.queryByLabelText('Parish / Church')).toBeNull()
    expect(screen.getByText('Donations / Stewardship')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Giving & Stewardship' }).getAttribute('href')).toBe(
      '/giving',
    )
    expect(
      screen
        .getAllByRole('link', { name: 'View Prayer & Details' })
        .some((link) => link.getAttribute('href') === '/prayers/grid-1-slug'),
    ).toBe(true)
    expect(screen.queryByText(/Year [ABC]/)).toBeNull()
    expect(screen.queryByText('Consecutive Days in Prayer')).toBeNull()
    expect(screen.queryByText(/Believers Praying Today/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Share prayer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Saving prayers is not available yet' })).toBeNull()
  })

  it('cleans ElevenLabs cues and clamps complete card quotes to three lines', () => {
    const tagged = {
      ...prayer('tagged', false, '[calm] Evening stillness'),
      introduction: '<p>[warm] Rest in God.</p>',
      body: '<p>[softly] First sentence.</p><p>[pause] Second sentence remains.</p>',
    }
    renderArchive(archive([tagged]))

    expect(screen.getByRole('heading', { name: 'Evening stillness' })).toBeTruthy()
    expect(screen.getByText('Rest in God.')).toBeTruthy()
    const quote = screen.getByText('“First sentence. Second sentence remains.”')
    expect(quote.classList.contains('line-clamp-3')).toBe(true)
    expect(quote.getAttribute('title')).toBe('First sentence. Second sentence remains.')
    expect(screen.queryByText(/\[(?:calm|warm|softly|pause)\]/i)).toBeNull()
  })

  it('debounces search and fetches filtered prayers from the server without navigation', async () => {
    const filtered = archive([prayer('evening', false, 'Evening peace')])
    respondWith(filtered)
    renderArchive(archive([prayer('morning', false, 'Morning gratitude')]))

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'evening' } })

    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/site/prayers',
        expect.objectContaining({ params: expect.objectContaining({ search: 'evening' }) }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Evening peace' })).toBeTruthy()
  })

  it('runs format filtering on the server and keeps the church filter in the header', async () => {
    const user = userEvent.setup()
    respondWith(archive([]))
    renderArchive(archive([prayer('grid-1', false)]))

    await user.click(screen.getByLabelText('Format'))
    await user.click(
      await screen.findByText('Audio', { selector: '.ant-select-item-option-content' }),
    )

    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/site/prayers',
        expect.objectContaining({ params: expect.objectContaining({ format: 'audio' }) }),
      ),
    )
    expect(screen.queryByLabelText('Parish / Church')).toBeNull()
  })

  it('fetches the next page from the server without navigating', async () => {
    const firstPage = archive(
      Array.from({ length: 6 }, (_, index) => prayer(`p-${index}`, false)),
      {
        total: 7,
        totalPages: 2,
      },
    )
    respondWith(
      archive([prayer('p-7', false, 'Final prayer')], { total: 7, page: 2, totalPages: 2 }),
    )
    renderArchive(firstPage)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))

    await waitFor(() =>
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/site/prayers',
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
      ),
    )
    expect(await screen.findByRole('heading', { name: 'Final prayer' })).toBeTruthy()
    // Outlast the 300ms search debounce: an unchanged search must not reset to page 1.
    await new Promise((resolve) => setTimeout(resolve, 350))
    expect(screen.getByText('Showing 7–7 of 7 sacred prayers')).toBeTruthy()
  })

  it('renders the honest no-fellowship state', () => {
    renderArchive(
      archive([], {
        featured: null,
        churches: [],
        languages: [],
        selectedChurchId: null,
        selectedChurchName: null,
      }),
    )

    expect(screen.getByRole('heading', { name: 'Build your fellowship first' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open profile' }).getAttribute('href')).toBe(
      '/customer',
    )
  })
})
