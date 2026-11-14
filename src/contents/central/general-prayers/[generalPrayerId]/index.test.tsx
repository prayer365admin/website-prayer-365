import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The editor must show the SAVED prayer text, not an empty field: the API
 * returns `body`, so an empty textarea means the form never received it and the
 * Generate-audio button stays disabled with "Write the prayer text first."
 * React Quill is client-only, so this asserts the controlled-value contract.
 */

const hooks = vi.hoisted(() => ({
  detail: vi.fn(),
  update: vi.fn(),
  enqueue: vi.fn(),
  audioAccess: vi.fn(),
}))

const registry = vi.hoisted(() => ({ useLanguages: vi.fn() }))

vi.mock('@/hooks/data/general-prayer', () => ({
  useGeneralPrayer: hooks.detail,
  useUpdateGeneralPrayer: hooks.update,
  useEnqueueGeneralPrayerAudio: hooks.enqueue,
  useGeneralPrayerAudioAccess: hooks.audioAccess,
}))

vi.mock('@/hooks/data/central', () => ({ useLanguages: registry.useLanguages }))

vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: () => ({ granted: true }),
    updateOwn: () => ({ granted: true }),
  }),
}))

vi.mock('@/components/common/rich-text-editor', () => ({
  default: ({
    ariaLabel,
    value,
    onChange,
  }: {
    ariaLabel: string
    value?: string | null
    onChange?: (value: string) => void
  }) => (
    <div>
      <div aria-label="Text formatting" role="toolbar" />
      <textarea
        aria-label={ariaLabel}
        onChange={(event) => onChange?.(event.target.value)}
        value={value ?? ''}
      />
    </div>
  ),
}))

import ContentsCentralGeneralPrayerEditor from './index'

const BODY = '<p>Kes võib tulla Jumala ligi? See, kes on laitmatu.</p>'

const prayer = {
  id: 'gp-1',
  slug: 'paivapalve-1',
  sequence: 1,
  title: 'Hoia oma jalga',
  introduction: null,
  body: BODY,
  verse: 'Hoia oma jalga, kui sa lähed Jumala kotta. Kuulaminek on parem kui alpide ohvriand.',
  verseReference: 'Kg 4,17',
  liturgicalNote: null,
  references: 'Lk 9,51–56',
  languageCode: 'et',
  audioStatus: 'QUEUED',
  audioAssetId: null,
  providerRequestId: null,
  audioErrorCode: null,
  audioGeneratedAt: null,
  isActive: true,
  version: 3,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionMock.mockReturnValue({
    data: { user: { user_id: 'admin', role: { name: 'administrator' } } },
  })
  hooks.detail.mockReturnValue({ data: prayer, loading: false, error: undefined })
  hooks.update.mockReturnValue({ onUpdate: vi.fn(), loading: false })
  hooks.enqueue.mockReturnValue({ onEnqueueAudio: vi.fn(), loading: false })
  hooks.audioAccess.mockReturnValue({ data: undefined, loading: false })
  registry.useLanguages.mockReturnValue({
    data: [
      { code: 'et', name: 'Estonian', enabled: true, version: 1, ready: true },
      { code: 'en', name: 'English', enabled: true, version: 1, ready: true },
      { code: 'sv', name: 'Swedish', enabled: false, version: 1, ready: true },
    ],
    loading: false,
  })
})

describe('general prayer editor', () => {
  it('prefills the saved prayer text into the body field', async () => {
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    const bodyField = (await screen.findByLabelText('Prayer text')) as HTMLTextAreaElement
    expect(bodyField.value).toBe(BODY)
    expect(screen.queryByText('Write the prayer text first.')).toBeNull()
  })

  it('prefills the copy fields and the sequence position', async () => {
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    await waitFor(() => expect(screen.getByLabelText('Prayer text')).toBeTruthy())
    expect((screen.getByDisplayValue('Hoia oma jalga') as HTMLInputElement).value).toBe(
      'Hoia oma jalga',
    )
    expect((screen.getByDisplayValue('Kg 4,17') as HTMLInputElement).value).toBe('Kg 4,17')
    expect(
      (screen.getByDisplayValue(/Kuulaminek on parem/) as HTMLTextAreaElement).value,
    ).toContain('Kuulaminek')
    expect(screen.getByText('Cycle position 1')).toBeTruthy()
    expect(screen.getByText('Version 3')).toBeTruthy()
  })

  it('offers the enabled registry languages as content language options', async () => {
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    const select = await screen.findByLabelText('Content language')
    fireEvent.mouseDown(select)
    expect(await screen.findByTitle('en — English')).toBeTruthy()
    // A disabled registry row is never offered: the API rejects it.
    expect(screen.queryByTitle('sv — Swedish')).toBeNull()
  })

  it('enables Generate audio once the text is present', async () => {
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    const button = (await screen.findByRole('button', {
      name: /Generate audio/i,
    })) as HTMLButtonElement
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('shows a QUEUED row as not generated yet, with the button enabled', async () => {
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    expect(await screen.findByText('No audio generated yet.')).toBeTruthy()
    expect(screen.queryByText(/Generating audio/)).toBeNull()
  })

  it('plays a ready asset in the dashboard waveform control, never the native audio bar', async () => {
    hooks.detail.mockReturnValue({
      data: {
        ...prayer,
        audioStatus: 'READY',
        audioAssetId: 'asset-1',
        audioGeneratedAt: '2026-11-13T10:40:12.000Z',
      },
      loading: false,
    })
    hooks.audioAccess.mockReturnValue({
      data: { url: 'https://cdn.test/general/paivapalve-2.mp3' },
      loading: false,
    })

    const { container } = renderWithProviders(
      <ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />,
    )

    expect(await screen.findByRole('button', { name: /Play Audio for/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Download Audio for/i }).getAttribute('href')).toBe(
      'https://cdn.test/general/paivapalve-2.mp3',
    )
    // The native control must not come back: the dashboard uses its own waveform player.
    expect(container.querySelector('audio[controls]')).toBeNull()
  })

  it('explains why audio cannot be generated when the text is empty', async () => {
    hooks.detail.mockReturnValue({
      data: { ...prayer, body: '' },
      loading: false,
      error: undefined,
    })
    renderWithProviders(<ContentsCentralGeneralPrayerEditor generalPrayerId="gp-1" />)

    expect(await screen.findByText('Write the prayer text first.')).toBeTruthy()
    const button = screen.getByRole('button', { name: /Generate audio/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
