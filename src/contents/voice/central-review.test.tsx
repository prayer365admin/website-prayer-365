import { pushMock, renderWithProviders, sessionMock } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  useCentralVoiceProfiles: vi.fn(),
  useCentralVoiceProfile: vi.fn(),
  useApproveVoiceProfile: vi.fn(() => ({ onApprove: vi.fn(), loading: false })),
  useRejectVoiceProfile: vi.fn(() => ({ onReject: vi.fn(), loading: false })),
  useDisableVoiceProfile: vi.fn(() => ({ onDisable: vi.fn(), loading: false })),
  useRevokeVoiceConsent: vi.fn(() => ({ onRevokeConsent: vi.fn(), loading: false })),
  useRecloneVoiceProfile: vi.fn(() => ({ onReclone: vi.fn(), loading: false })),
}))
const granted = vi.hoisted(() => ({ value: true }))
const pagination = vi.hoisted(() => ({
  page: 1,
  pageSize: 10,
  setPage: vi.fn(),
  setPageSize: vi.fn(),
}))
vi.mock('@/hooks/data/voice', () => voice)
vi.mock('@/hooks/ui/url-pagination', () => ({
  useUrlPagination: () => pagination,
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({ updateAny: () => ({ granted: granted.value }) }),
}))
vi.mock('@/hooks/data/media-access', () => ({
  useMediaAccess: () => ({ data: { url: 'https://s3/file' }, loading: false }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

import ContentsVoiceReview from './central-review'
import ContentsVoiceReviewDetail from './central-review-detail'

const ADMIN = 'admin-1'

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  pastorId: 'p1',
  pastorName: 'Pastor A',
  pastorImageAssetId: null,
  pastorImageChurchId: null,
  churchId: 'ch1',
  churchName: 'Example Church',
  version: 2,
  provider: 'elevenlabs',
  reviewState: 'SUBMITTED',
  registrationState: 'UNREGISTERED',
  submittedAt: '2026-09-24T00:00:00.000Z',
  reviewedAt: null,
  reviewedByName: null,
  reviewReason: null,
  consentRevokedAt: null,
  replacesProfileId: null,
  requiresVerification: null,
  lastErrorCode: null,
  samples: [{ assetId: 's1', position: 0, mimeType: 'audio/mpeg', byteSize: 1, checksum: 'a' }],
  createdAt: '2026-09-24T00:00:00.000Z',
  consentId: 'c1',
  termsVersion: 'offline-authorization-v1',
  consentRecordedAt: '2026-09-24T00:00:00.000Z',
  evidenceAssetId: 'e1',
  cloningMethod: 'instant',
  providerVoiceId: null,
  submittedBy: 'pastor-user',
  pastorUserId: 'pastor-user',
  ...over,
})

/** Open the detail page for one voice profile. */
const show = (d: ReturnType<typeof detail>) => {
  voice.useCentralVoiceProfile.mockReturnValue({ data: d, loading: false, error: null })
  renderWithProviders(<ContentsVoiceReviewDetail voiceId={d.id} />)
}

describe('ContentsVoiceReview list (S24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pagination.page = 1
    pagination.pageSize = 10
  })

  it('matches the AI voice profile table with combined pastor/church identity', () => {
    voice.useCentralVoiceProfiles.mockReturnValue({
      data: [detail({ reviewState: 'APPROVED', reviewedByName: 'Global Admin' })],
      total: 1,
      loading: false,
    })
    renderWithProviders(<ContentsVoiceReview />)
    expect(screen.getByRole('heading', { name: 'AI Voice Profiles' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Pastor \(Church\)/ })).toBeTruthy()
    expect(screen.getByText('Example Church')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Approved' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Reviewed by/ })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Global Admin' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Not registered' })).toBeTruthy()
  })

  it('has review, registration, submitted-date filters and a search box above the table', () => {
    voice.useCentralVoiceProfiles.mockReturnValue({ data: [], total: 0, loading: false })
    renderWithProviders(<ContentsVoiceReview />)
    expect(screen.getByLabelText('Filter admin review')).toBeTruthy()
    expect(screen.getByLabelText('Filter registration')).toBeTruthy()
    expect(screen.getByPlaceholderText('Published from')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search pastors or parishes...')).toBeTruthy()
    expect(voice.useCentralVoiceProfiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: 'created_at', orderDirection: 'desc', page: 1 }),
    )
  })

  it('continues row numbering from the current page', () => {
    pagination.page = 2
    voice.useCentralVoiceProfiles.mockReturnValue({ data: [detail()], total: 12, loading: false })

    renderWithProviders(<ContentsVoiceReview />)

    expect(screen.getByRole('columnheader', { name: 'No.' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '11' })).toBeTruthy()
    expect(voice.useCentralVoiceProfiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
    )
  })

  it('sorting a column asks the API for that order', () => {
    voice.useCentralVoiceProfiles.mockReturnValue({ data: [detail()], total: 1, loading: false })
    renderWithProviders(<ContentsVoiceReview />)
    fireEvent.click(screen.getByRole('columnheader', { name: /Pastor \(Church\)/ }))
    expect(voice.useCentralVoiceProfiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderBy: 'pastor_name', orderDirection: 'asc' }),
    )
  })

  it('the Actions column opens the profile and offers safe disable instead of deletion', () => {
    voice.useCentralVoiceProfiles.mockReturnValue({ data: [detail()], total: 1, loading: false })
    renderWithProviders(<ContentsVoiceReview />)
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeTruthy()
    fireEvent.click(screen.getByRole('cell', { name: 'Not registered' }))
    expect(pushMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review Pastor A' }))
    expect(pushMock).toHaveBeenCalledWith('/dashboard/central/voice-profiles/v1')
    expect(screen.getByRole('button', { name: 'Disable Pastor A' })).toBeTruthy()
  })
})

describe('ContentsVoiceReviewDetail page (S24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    granted.value = true
    sessionMock.mockReturnValue({ data: { user: { user_id: ADMIN } }, status: 'authenticated' })
  })

  it('uses the designed detail header with a back button and the pastor name', () => {
    show(detail())
    expect(screen.getByRole('heading', { name: 'Pastor A' })).toBeTruthy()
    expect(screen.getByText('Submitted 24/09/2026')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'arrow-left' })).toBeTruthy()
  })

  it('uses a structure-matched two-column skeleton while the detail is loading', () => {
    voice.useCentralVoiceProfile.mockReturnValue({ data: undefined, loading: true, error: null })
    renderWithProviders(<ContentsVoiceReviewDetail voiceId="v1" />)

    expect(screen.getByRole('heading', { name: 'Loading voice submission' })).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Loading voice profile details' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Voice Samples' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Offline authorization' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Registration' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Voice Controls' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Submission status' })).toBeTruthy()
  })

  it('shows not found for an unknown voice id', () => {
    voice.useCentralVoiceProfile.mockReturnValue({
      data: undefined,
      loading: false,
      error: Object.assign(new Error('x'), { isAxiosError: true, response: { status: 404 } }),
    })
    renderWithProviders(<ContentsVoiceReviewDetail voiceId="nope" />)
    expect(screen.getByText('Voice submission not found')).toBeTruthy()
  })

  it('offers Approve and register / Reject for a pending submission; reject needs a reason', () => {
    show(detail())
    expect(screen.getByRole('button', { name: 'Approve and register' })).toBeTruthy()
    const reject = screen.getByRole('button', { name: 'Reject' })
    expect(reject).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByPlaceholderText('Explain what needs correction'), {
      target: { value: 'Background noise' },
    })
    expect(reject).toHaveProperty('disabled', false)
    expect(screen.getByText('Voice ID: Assigned after registration')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View signed evidence' })).toBeTruthy()
  })

  it('hides review actions from the linked pastor (no self-approval)', () => {
    show(detail({ pastorUserId: ADMIN }))
    expect(screen.getByText('You cannot review your own submission.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })

  it('shows who reviewed it in the history timeline', () => {
    show(
      detail({
        reviewState: 'APPROVED',
        registrationState: 'READY',
        reviewedAt: '2026-10-05T00:00:00.000Z',
        reviewedByName: 'Global Admin',
        timeline: [
          {
            action: 'voice.profile.approve',
            outcome: 'success',
            at: '2026-10-05T00:00:00.000Z',
            actorName: 'Global Admin',
          },
        ],
      }),
    )
    // "Approved" (review) + "Queued for registration" (registration), both by the reviewer
    expect(screen.getByText('Approved')).toBeTruthy()
    expect(screen.getAllByText(/by Global Admin/)).toHaveLength(2)
  })

  it('shows disable / revoke for an approved voice, with the read-only Voice ID', () => {
    show(detail({ reviewState: 'APPROVED', registrationState: 'READY', providerVoiceId: 'vx1' }))
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Disable voice' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revoke consent' })).toBeTruthy()
    expect(screen.getByText(/Voice ID: vx1/)).toBeTruthy()
  })

  it('offers Re-create voice only when the voice went missing at the provider', () => {
    show(
      detail({
        reviewState: 'APPROVED',
        registrationState: 'FAILED',
        lastErrorCode: 'PROVIDER_VOICE_MISSING',
      }),
    )
    expect(screen.getByRole('button', { name: 'Re-create voice' })).toBeTruthy()
    expect(screen.getByText(/no longer exists at the provider/)).toBeTruthy()
  })

  it('offers Retry registration for a fixable failure', () => {
    show(
      detail({
        reviewState: 'APPROVED',
        registrationState: 'FAILED',
        lastErrorCode: 'VOICE_CREATE_REJECTED',
      }),
    )
    expect(screen.getByRole('button', { name: 'Retry registration' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Re-create voice' })).toBeNull()
  })

  it('explains when a retry cannot fix the failure', () => {
    show(
      detail({
        reviewState: 'APPROVED',
        registrationState: 'FAILED',
        lastErrorCode: 'CHECKSUM_MISMATCH',
      }),
    )
    expect(screen.queryByRole('button', { name: 'Retry registration' })).toBeNull()
    expect(screen.getByText(/needs to submit a new revision/)).toBeTruthy()
  })

  it('shows no actions without voice-review update permission', () => {
    granted.value = false
    show(detail())
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })
})
