import { renderWithProviders, sessionMock } from '@/test/frontend/render'
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const voice = vi.hoisted(() => ({
  useCentralVoiceProfiles: vi.fn(),
  useCentralVoiceProfile: vi.fn(),
  useApproveVoiceProfile: vi.fn(() => ({ onApprove: vi.fn(), loading: false })),
  useRejectVoiceProfile: vi.fn(() => ({ onReject: vi.fn(), loading: false })),
  useDisableVoiceProfile: vi.fn(() => ({ onDisable: vi.fn(), loading: false })),
  useRevokeVoiceConsent: vi.fn(() => ({ onRevokeConsent: vi.fn(), loading: false })),
}))
const granted = vi.hoisted(() => ({ value: true }))
vi.mock('@/hooks/data/voice', () => voice)
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

const ADMIN = 'admin-1'

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'v1',
  pastorId: 'p1',
  pastorName: 'Pastor A',
  churchId: 'ch1',
  churchName: 'Example Church',
  version: 2,
  provider: 'elevenlabs',
  reviewState: 'SUBMITTED',
  registrationState: 'UNREGISTERED',
  submittedAt: '2026-09-24T00:00:00.000Z',
  reviewedAt: null,
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

const show = (d: ReturnType<typeof detail>) => {
  voice.useCentralVoiceProfiles.mockReturnValue({ data: [d], total: 1, loading: false })
  voice.useCentralVoiceProfile.mockReturnValue({ data: d, loading: false })
  renderWithProviders(<ContentsVoiceReview />)
  fireEvent.click(screen.getByText('Pastor A'))
}

describe('ContentsVoiceReview (S24)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    granted.value = true
    sessionMock.mockReturnValue({ data: { user: { user_id: ADMIN } }, status: 'authenticated' })
  })

  it('lists pastor/church with separate review and registration columns', () => {
    voice.useCentralVoiceProfiles.mockReturnValue({ data: [detail()], total: 1, loading: false })
    voice.useCentralVoiceProfile.mockReturnValue({ data: undefined, loading: false })
    renderWithProviders(<ContentsVoiceReview />)
    expect(screen.getByText('Example Church')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Submitted' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Not registered' })).toBeTruthy()
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

  it('shows disable / revoke for an approved voice, with the read-only Voice ID', () => {
    show(detail({ reviewState: 'APPROVED', registrationState: 'READY', providerVoiceId: 'vx1' }))
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Disable voice' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Revoke consent' })).toBeTruthy()
    expect(screen.getByText('Voice ID: vx1')).toBeTruthy()
  })

  it('shows no actions without voice-review update permission', () => {
    granted.value = false
    show(detail())
    expect(screen.queryByRole('button', { name: 'Approve and register' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })
})
