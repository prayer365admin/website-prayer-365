import { replaceMock, axiosMock, resolveGet } from '@/test/frontend/render'
import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ContentsChurchesPrayersEditor from './editor'

// React Quill is client-only and is covered by production compilation. Keep
// these form-flow tests focused on the controlled value contract.
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

describe('ContentsChurchesPrayersEditor', () => {
  const pastorA = {
    id: 'pastor-1',
    name: 'Pastor A',
    introduction: null,
    pastoralRole: 'Lead',
    imageAssetId: null,
    activeVoiceProfileId: 'vo1',
    voiceReady: true,
  }
  const profile = {
    id: 'c1',
    name: 'Example Church',
    languageCodes: ['en', 'et'],
    timezone: 'Europe/Tallinn',
  }
  const detail = {
    id: 'p1',
    churchId: 'c1',
    version: 1,
    createdAt: '2025-01-01T00:00:00Z',
    current: {
      id: 'pv1',
      versionNumber: 1,
      title: 'Morning prayer',
      introduction: null,
      pastorId: 'pastor-1',
      languageCode: 'en',
      body: 'Hello world',
      approvedBy: null,
      selectedAudioId: null,
    },
    scheduled: null,
    published: null,
    textApproved: false,
  }

  const audioQueued = {
    id: 'a1',
    prayerVersionId: 'pv1',
    prayerId: 'p1',
    voiceProfileId: 'vo1',
    status: 'QUEUED',
    assetId: null,
    providerRequestId: null,
    approvedBy: null,
    approvedAt: null,
    errorCode: null,
    createdAt: '2025-01-01T00:00:00Z',
  }
  const audioReady = { ...audioQueued, status: 'READY', assetId: 'asset1' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let audioFixture: any = audioReady
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let detailFixture: any = detail

  beforeEach(() => {
    audioFixture = audioReady
    detailFixture = detail
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
    axiosMock.patch.mockClear()
    replaceMock.mockClear()

    axiosMock.get.mockImplementation((url: string) => {
      if (url.includes('/pastors')) {
        return Promise.resolve({ data: resolveGet([pastorA]) })
      }
      if (url.includes('/profile')) {
        return Promise.resolve({ data: resolveGet(profile) })
      }
      if (url.includes('/audio/')) {
        return Promise.resolve({ data: resolveGet(audioFixture) })
      }
      if (url.includes('/uploads/asset1/access')) {
        return Promise.resolve({
          data: resolveGet({
            assetId: 'asset1',
            purpose: 'GENERATED_AUDIO',
            mimeType: 'audio/mpeg',
            byteSize: 100,
            status: 'READY',
            url: 'https://s3.example/signed',
            expiresIn: 3600,
          }),
        })
      }
      if (url.includes('/prayers/p1')) {
        return Promise.resolve({ data: resolveGet(detailFixture, detailFixture.version) })
      }
      return Promise.reject(new Error(`Not found: ${url}`))
    })
  })

  it('Create mode: form renders, validation blocks empty save, then create POSTs and redirects', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" />)

    // Wait for queries
    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeTruthy()
    })

    expect(screen.getByLabelText('Title')).toBeTruthy()
    expect((await screen.findByRole('textbox', { name: 'Introduction' })).tagName).toBe('TEXTAREA')
    expect(screen.getByRole('textbox', { name: 'Full prayer text' }).tagName).toBe('TEXTAREA')
    expect(screen.getAllByRole('toolbar', { name: 'Text formatting' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Save text' })).toBeTruthy()

    expect(screen.queryByRole('button', { name: 'Review text for audio' })).toBeNull()

    // Validation blocks empty save
    await user.click(screen.getByRole('button', { name: 'Save text' }))
    expect(axiosMock.post).not.toHaveBeenCalled()

    // Fill form
    await user.type(screen.getByLabelText('Title'), 'New prayer')
    await user.type(screen.getByLabelText('Full prayer text'), 'Hello')

    await user.click(screen.getByLabelText('Pastor'))
    const pastorOptions = await screen.findAllByText('Pastor A')
    await user.click(pastorOptions[pastorOptions.length - 1])

    await user.click(screen.getByLabelText('Content language'))
    const langOptions = await screen.findAllByText('en')
    await user.click(langOptions[langOptions.length - 1])

    axiosMock.post.mockResolvedValueOnce({ data: { result: detail } })

    // Save
    await user.click(screen.getByRole('button', { name: 'Save text' }))

    await waitFor(() => {
      expect(axiosMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/churches/c1/prayers'),
        expect.objectContaining({
          title: 'New prayer',
          body: 'Hello',
          pastorId: 'pastor-1',
          languageCode: 'en',
        }),
      )
    })
    expect(replaceMock).toHaveBeenCalledWith('/dashboard/churches/c1/prayers/p1')
  })

  it('Edit mode: prefilled detail, PATCH carries version', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)

    // Wait for queries and prefill
    await screen.findByDisplayValue('Morning prayer')
    await waitFor(() => {
      expect(screen.getByLabelText('Full prayer text').textContent).toContain('Hello world')
    })

    axiosMock.patch.mockResolvedValueOnce({ data: { result: detail } })

    await user.click(screen.getByRole('button', { name: 'Save text' }))

    await waitFor(() => {
      expect(axiosMock.patch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/churches/c1/prayers/p1'),
        expect.objectContaining({ version: 1 }),
      )
    })
  })

  it('Review modal shows the saved snapshot; approve calls approve-text', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)

    await screen.findByDisplayValue('Morning prayer')

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await user.click(screen.getByRole('button', { name: 'View reviewed text' }))

    // Assert modal content
    const dialog = screen.getByRole('dialog')
    const modalContent = await within(dialog).findByText('Hello world')
    expect(modalContent).toBeTruthy()
    axiosMock.post.mockResolvedValueOnce({ data: { result: detail.current } })

    await user.click(screen.getByRole('button', { name: 'Approve text for audio' }))

    await waitFor(() => {
      expect(axiosMock.post).toHaveBeenCalledWith(
        expect.stringContaining('/approve-text'),
        expect.objectContaining({ version: 1, prayerVersionId: 'pv1' }),
      )
    })
  })

  it('Review drawer shows the approver name instead of the user ID', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: {
        ...detail.current,
        approvedBy: 'user-123',
        approvedByName: 'Mikk Leedjärv',
      },
    }
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)

    await screen.findByDisplayValue('Morning prayer')
    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await user.click(screen.getByRole('button', { name: 'View reviewed text' }))

    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Text approved by Mikk Leedjärv')).toBeTruthy()
    expect(within(dialog).queryByText(/user-123/)).toBeNull()
  })

  it('Create mode: Audio tab disabled with save-first reason', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await screen.findByText('Save the text first.')

    const generateBtn = screen.getByRole('button', { name: 'Generate audio' }) as HTMLButtonElement
    expect(generateBtn.disabled).toBe(true)

    const publishBtn = screen.getByRole('button', { name: 'Publish now' }) as HTMLButtonElement
    expect(publishBtn.disabled).toBe(true)
  })

  it('Edit mode, text not approved: generate blocked with text reason', async () => {
    detailFixture = { ...detail, textApproved: false }
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await screen.findByText('Approve the reviewed text first.')
    const generateBtn = screen.getByRole('button', { name: 'Generate audio' }) as HTMLButtonElement
    expect(generateBtn.disabled).toBe(true)
  })

  it('Generate audio POSTs enqueue with the voice profile', async () => {
    detailFixture = { ...detail, textApproved: true }
    audioFixture = audioQueued
    axiosMock.post.mockResolvedValueOnce({ data: { result: audioQueued } })
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    const generateBtn = screen.getByRole('button', { name: 'Generate audio' }) as HTMLButtonElement
    expect(generateBtn.disabled).toBe(false)
    await user.click(generateBtn)

    expect(axiosMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/prayers/p1/audio'),
      expect.objectContaining({ version: 1, prayerVersionId: 'pv1', voiceProfileId: 'vo1' }),
      expect.anything(),
    )
    await screen.findByText('Generating audio…')
  })
  it('Generating new audio when one is already approved shows the loading state', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, selectedAudioId: 'a1' },
    }
    audioFixture = { ...audioReady, status: 'APPROVED', approvedAt: '2025-01-01T00:00:00Z' }
    axiosMock.post.mockResolvedValueOnce({ data: { result: { ...audioQueued, id: 'new-audio' } } })
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))

    // initially shows the approved audio state
    await screen.findByText('Audio approved.')

    // when generate starts, hook refetches. change fixture to queued state.
    audioFixture = { ...audioQueued, id: 'new-audio' }

    const generateBtn = screen.getByRole('button', { name: 'Generate audio' })
    await user.click(generateBtn)

    expect(axiosMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/prayers/p1/audio'),
      expect.objectContaining({ version: 1, prayerVersionId: 'pv1', voiceProfileId: 'vo1' }),
      expect.anything(),
    )
    await screen.findByText('Generating audio…')
  })

  it('Ready audio: preview player renders; approve POSTs approve-audio', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, selectedAudioId: 'a1' },
    }
    audioFixture = audioReady
    axiosMock.post.mockResolvedValueOnce({ data: { result: audioReady } })
    const user = userEvent.setup()
    const { container } = renderWithProviders(
      <ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />,
    )
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await waitFor(() => {
      expect(container.querySelector('audio')?.getAttribute('src')).toBe(
        'https://s3.example/signed',
      )
    })

    const approveBtn = screen.getByRole('button', { name: 'Approve audio' }) as HTMLButtonElement
    expect(approveBtn.disabled).toBe(false)
    await user.click(approveBtn)

    expect(axiosMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/audio/a1/approve'),
      expect.objectContaining({ version: 1, prayerVersionId: 'pv1' }),
    )
  })

  it('Audio failed because the voice is missing: warning, no Generate-again (F4VO V8)', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, selectedAudioId: 'a1' },
    }
    audioFixture = { ...audioQueued, status: 'FAILED', errorCode: 'VOICE_MISSING_AT_PROVIDER' }
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title')
    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    expect(
      await screen.findByText("The pastor's voice no longer exists at the provider."),
    ).toBeTruthy()
    // No role in this suite → no voice-generation grant → told to ask an admin.
    expect(screen.getByText('Ask an admin to re-create the voice.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Generate again' })).toBeNull()
  })

  it('After a reload, resumes a generation still running in the worker (no double generate)', async () => {
    // Fresh page load: no in-memory pending id, only the server's latest audio for this version.
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, latestAudioId: 'a1', latestAudioStatus: 'GENERATING' },
    }
    audioFixture = { ...audioQueued, status: 'GENERATING' }
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title')
    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))

    expect((await screen.findAllByText(/Generating audio/)).length).toBeGreaterThan(0)
    expect(axiosMock.get).toHaveBeenCalledWith(expect.stringContaining('/audio/a1'))
    const generate = screen.getByRole('button', { name: 'Generate audio' }) as HTMLButtonElement
    expect(generate.disabled).toBe(true)
    expect(screen.getByText('Audio is already being generated for this text.')).toBeTruthy()
  })

  it('After a reload, shows a finished but unapproved audio ready to preview and approve', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, latestAudioId: 'a1', latestAudioStatus: 'READY' },
    }
    audioFixture = audioReady
    const user = userEvent.setup()
    const { container } = renderWithProviders(
      <ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />,
    )
    await screen.findByLabelText('Title')
    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))
    await waitFor(() =>
      expect(container.querySelector('audio')?.getAttribute('src')).toBe(
        'https://s3.example/signed',
      ),
    )
    expect(
      (screen.getByRole('button', { name: 'Approve audio' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('Schedule publication sends tz-aware ISO', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, selectedAudioId: 'a1' },
    }
    axiosMock.put.mockResolvedValueOnce({ data: { result: detail } })
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))

    const dateParent = screen.getByText('Publication date').parentElement!
    const dateInput = dateParent.querySelector('input') as HTMLInputElement
    await user.type(dateInput, '2026-10-18')
    await user.keyboard('{Enter}')

    const timeParent = screen.getByText('Time').parentElement!
    const timeInput = timeParent.querySelector('input') as HTMLInputElement
    await user.type(timeInput, '07:00')
    await user.keyboard('{Enter}')

    const scheduleBtn = screen.getByRole('button', {
      name: 'Schedule publication',
    }) as HTMLButtonElement
    expect(scheduleBtn.disabled).toBe(false)
    await user.click(scheduleBtn)

    expect(axiosMock.put).toHaveBeenCalledWith(
      expect.stringContaining('/prayers/p1/schedule'),
      expect.objectContaining({
        version: 1,
        prayerVersionId: 'pv1',
        scheduledAt: '2026-10-18T04:00:00.000Z',
      }),
    )
  })

  it('Publish now POSTs publish action', async () => {
    detailFixture = {
      ...detail,
      textApproved: true,
      current: { ...detail.current, selectedAudioId: 'a1' },
    }
    axiosMock.post.mockResolvedValueOnce({ data: { result: detail } })
    const user = userEvent.setup()
    renderWithProviders(<ContentsChurchesPrayersEditor churchId="c1" prayerId="p1" />)
    await screen.findByLabelText('Title') // wait for render

    await user.click(screen.getByRole('tab', { name: 'Audio & Publication' }))

    const publishBtn = screen.getByRole('button', { name: 'Publish now' }) as HTMLButtonElement
    expect(publishBtn.disabled).toBe(false)
    await user.click(publishBtn)

    expect(axiosMock.post).toHaveBeenCalledWith(
      expect.stringContaining('/prayers/p1/publish'),
      expect.objectContaining({ version: 1, prayerVersionId: 'pv1' }),
      expect.anything(),
    )
  })
})
