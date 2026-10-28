import { describe, expect, it } from 'vitest'
import { registrationSteps, reviewSteps } from './timeline'

const at = (n: number) => `2026-10-0${n}T10:00:00.000Z`
const base = {
  id: 'v1',
  pastorId: 'p1',
  pastorName: 'Pastor A',
  pastorImageAssetId: null,
  pastorImageChurchId: null,
  churchId: 'c1',
  churchName: 'Tallinn',
  version: 3,
  provider: 'elevenlabs',
  reviewState: 'APPROVED',
  registrationState: 'READY',
  submittedAt: at(2),
  reviewedAt: at(3),
  reviewedByName: 'Admin',
  reviewReason: null,
  consentRevokedAt: null,
  replacesProfileId: null,
  requiresVerification: false,
  lastErrorCode: null,
  samples: [],
  createdAt: at(1),
  timeline: [
    { action: 'voice.submission.create', outcome: 'success', at: at(1), actorName: 'Pastor' },
    { action: 'voice.consent.create', outcome: 'success', at: at(1), actorName: 'Pastor' },
    { action: 'voice.submission.submit', outcome: 'success', at: at(2), actorName: 'Pastor' },
    { action: 'voice.profile.approve', outcome: 'success', at: at(3), actorName: 'Admin' },
    { action: 'voice.register', outcome: 'failure', at: at(4), actorName: null },
    { action: 'voice.profile.reclone', outcome: 'success', at: at(5), actorName: 'Admin' },
    { action: 'voice.register', outcome: 'success', at: at(6), actorName: null },
  ],
}

describe('voice timeline (from audit log)', () => {
  it('review track: created → evidence → submitted → approved, by who', () => {
    const steps = reviewSteps(base)
    expect(steps.map((s) => s.title)).toEqual([
      'Draft created',
      'Authorization evidence recorded',
      'Submitted for review',
      'Approved',
    ])
    expect(steps[3].when).toContain('by Admin')
  })

  it('registration track: queued → failed → retried → registered; worker is "system"', () => {
    const steps = registrationSteps(base)
    expect(steps.map((s) => s.title)).toEqual([
      'Queued for registration',
      'Registration failed',
      'Registration requested again',
      'Registered with ElevenLabs',
    ])
    expect(steps[1].when).toContain('by system')
  })

  it('shows the open step for the current state', () => {
    expect(reviewSteps({ ...base, reviewState: 'SUBMITTED', timeline: [] }).at(-1)).toMatchObject({
      title: 'Waiting for admin review',
      loading: true,
    })
    expect(
      registrationSteps({ ...base, registrationState: 'REGISTERING', timeline: [] }).at(-1),
    ).toMatchObject({ title: 'Registering', loading: true })
    expect(
      registrationSteps({
        ...base,
        reviewState: 'SUBMITTED',
        registrationState: 'UNREGISTERED',
        timeline: [],
      }),
    ).toEqual([{ color: 'gray', title: 'Starts automatically after admin approval' }])
  })

  it('adds the reject reason and the current error code', () => {
    const rejected = reviewSteps({
      ...base,
      reviewState: 'REJECTED',
      reviewReason: 'Background noise',
      timeline: [
        { action: 'voice.profile.reject', outcome: 'success', at: at(3), actorName: 'Admin' },
      ],
    })
    expect(rejected[0].detail).toBe('Reason: Background noise')
    const failed = registrationSteps({
      ...base,
      registrationState: 'FAILED',
      lastErrorCode: 'VOICE_CREATE_REJECTED',
      timeline: base.timeline.slice(0, 5),
    })
    expect(failed.at(-1)).toMatchObject({
      title: 'Registration failed',
      detail: 'Error: VOICE_CREATE_REJECTED',
    })
  })
})
