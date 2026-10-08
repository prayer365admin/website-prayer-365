import { renderWithProviders } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  useMyVoiceSubmissions: vi.fn(),
  useMyVoiceChurches: vi.fn(),
  useCreateVoiceConsent: vi.fn(() => ({ onCreateConsent: vi.fn(), loading: false })),
  useCreateVoiceSubmission: vi.fn(() => ({ onCreate: vi.fn(), loading: false })),
  usePatchVoiceSubmission: vi.fn(() => ({ onPatch: vi.fn(), loading: false })),
  useSubmitVoiceSubmission: vi.fn(() => ({ onSubmit: vi.fn(), loading: false })),
}))
vi.mock('@/hooks/data/voice', () => voice)
vi.mock('@/hooks/data/media-upload', () => ({
  useMediaUpload: () => ({ onUpload: vi.fn(), loading: false }),
}))
vi.mock('@/hooks/data/media-access', () => ({
  useMediaAccess: () => ({ data: { url: 'https://s3/sample' }, loading: false }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

import ContentsMyVoice from './my-voice'

const profile = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  pastorId: 'p1',
  pastorName: 'Pastor A',
  churchId: 'ch1',
  churchName: 'Example Church',
  version: 2,
  provider: 'elevenlabs',
  reviewState: 'DRAFT',
  registrationState: 'UNREGISTERED',
  submittedAt: null,
  reviewedAt: null,
  reviewedByName: null,
  reviewReason: null,
  consentRevokedAt: null,
  replacesProfileId: null,
  requiresVerification: null,
  lastErrorCode: null,
  samples: [{ assetId: 's1', position: 0, mimeType: 'audio/mpeg', byteSize: 1, checksum: null }],
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
})

const list = (items: unknown[], error: unknown = null) =>
  voice.useMyVoiceSubmissions.mockReturnValue({
    data: items,
    total: items.length,
    loading: false,
    error,
  })

describe('ContentsMyVoice (S27)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    voice.useMyVoiceChurches.mockReturnValue({
      data: [{ id: 'ch1', name: 'Example Church' }],
      loading: false,
    })
  })

  it('explains when the pastor is not assigned to any church (no form)', () => {
    list([])
    voice.useMyVoiceChurches.mockReturnValue({ data: [], loading: false })
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('You are not assigned as a pastor of any church yet')).toBeTruthy()
    expect(screen.queryByText('Add audio file')).toBeNull()
  })

  it('shows a neutral state for an account not linked to a pastor', () => {
    list([], Object.assign(new Error('x'), { isAxiosError: true, response: { status: 403 } }))
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('Your account is not linked to a pastor profile')).toBeTruthy()
  })

  it('starts an empty draft with submit blocked until samples + evidence exist', () => {
    list([])
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('Add audio file')).toBeTruthy()
    expect(screen.getByText('Choose signed evidence')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Submit for review' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Save draft' })).toHaveProperty('disabled', true)
  })

  it('opens the recording tips', async () => {
    list([])
    renderWithProviders(<ContentsMyVoice />)
    fireEvent.click(screen.getByRole('button', { name: 'Recording tips' }))
    expect(await screen.findByText(/More than 3 minutes adds little/)).toBeTruthy()
  })

  it('lets a draft submit, and blocks adding beyond 5 files', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      assetId: `s${i}`,
      position: i,
      mimeType: 'audio/mpeg',
      byteSize: 1,
      checksum: null,
    }))
    list([profile({ samples: five })])
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('5/5 files')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Add audio file/ })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Submit for review' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('is read-only once submitted', () => {
    list([profile({ reviewState: 'SUBMITTED', submittedAt: '2026-10-02T00:00:00.000Z' })])
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('Waiting for admin review')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start new revision' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  })

  it('shows the rejection reason and allows a new revision', () => {
    list([profile({ reviewState: 'REJECTED', reviewReason: 'Background noise' })])
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('Background noise')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start new revision' }))
    expect(screen.getByText('Add audio file')).toBeTruthy()
  })

  it('keeps review and registration status separate for an approved voice', () => {
    list([profile({ reviewState: 'APPROVED', registrationState: 'VERIFICATION_REQUIRED' })])
    renderWithProviders(<ContentsMyVoice />)
    expect(screen.getByText('Admin review')).toBeTruthy()
    expect(screen.getByText('Registration')).toBeTruthy()
    expect(screen.getAllByText('Verification required').length).toBeGreaterThan(0)
    expect(screen.getByText(/Generation stays blocked/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start new revision' }))
    expect(screen.getByText(/current voice stays active/)).toBeTruthy()
  })
})
