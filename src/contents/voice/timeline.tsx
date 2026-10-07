import { VoiceProfileListItem, VoiceTimelineEvent } from '@/models/voice'
import { Timeline } from 'antd'
import { registrationLabel } from './status'

/*
 * Two-track history of a voice profile (F4VO): admin review and provider
 * registration, built from audit_logs (no extra schema). The open step at the
 * end is derived from the profile's current state.
 */

type Step = { color: string; title: string; when?: string; detail?: string; loading?: boolean }

const REVIEW_STEPS: Record<string, { title: string; color: string }> = {
  'voice.submission.create': { title: 'Draft created', color: 'gray' },
  'voice.consent.create': { title: 'Authorization evidence recorded', color: 'gray' },
  'voice.submission.submit': { title: 'Submitted for review', color: 'blue' },
  'voice.profile.approve': { title: 'Approved', color: 'green' },
  'voice.profile.reject': { title: 'Rejected', color: 'red' },
}

const REGISTRATION_STEPS: Record<string, { title: string; color: string }> = {
  'voice.profile.approve': { title: 'Queued for registration', color: 'blue' },
  'voice.profile.reclone': { title: 'Registration requested again', color: 'blue' },
  'voice.register:success': { title: 'Registered with ElevenLabs', color: 'green' },
  'voice.register:failure': { title: 'Registration failed', color: 'red' },
  'voice.register.discarded': { title: 'Discarded (disabled during registration)', color: 'gray' },
  'voice.provider.missing': { title: 'Voice missing at ElevenLabs', color: 'red' },
  'voice.profile.disable': { title: 'Disabled', color: 'gray' },
  'voice.consent.revoke': { title: 'Consent revoked', color: 'red' },
}

const lastWhere = (steps: Step[], test: (s: Step) => boolean) => [...steps].reverse().find(test)

const when = (e: VoiceTimelineEvent) =>
  `${new Date(e.at).toLocaleString()} · ${e.actorName ? `by ${e.actorName}` : 'by system'}`

const pick = (
  events: VoiceTimelineEvent[],
  steps: Record<string, { title: string; color: string }>,
): Step[] =>
  events.flatMap((e) => {
    const step = steps[`${e.action}:${e.outcome}`] ?? steps[e.action]
    return step ? [{ ...step, when: when(e) }] : []
  })

export const reviewSteps = (p: VoiceProfileListItem): Step[] => {
  const steps = pick(p.timeline ?? [], REVIEW_STEPS)
  const rejected = lastWhere(steps, (s) => s.title === 'Rejected')
  if (rejected && p.reviewReason) rejected.detail = `Reason: ${p.reviewReason}`
  if (p.reviewState === 'DRAFT') steps.push({ color: 'gray', title: 'Not submitted yet' })
  if (p.reviewState === 'SUBMITTED')
    steps.push({ color: 'blue', title: 'Waiting for admin review', loading: true })
  return steps
}

export const registrationSteps = (p: VoiceProfileListItem): Step[] => {
  const steps = pick(p.timeline ?? [], REGISTRATION_STEPS)
  const failed = lastWhere(steps, (s) => s.color === 'red')
  if (failed && p.registrationState === 'FAILED' && p.lastErrorCode)
    failed.detail = `Error: ${p.lastErrorCode}`
  const state = p.registrationState
  if (['QUEUED', 'REGISTERING', 'REGISTRATION_UNKNOWN'].includes(state))
    steps.push({ color: 'blue', title: registrationLabel(state), loading: true })
  if (state === 'VERIFICATION_REQUIRED')
    // The help line under the timeline explains what this means.
    steps.push({ color: 'orange', title: 'Verification required' })
  if (steps.length === 0)
    steps.push({ color: 'gray', title: 'Starts automatically after admin approval' })
  return steps
}

const toItems = (steps: Step[]) =>
  steps.map((s, i) => ({
    key: i,
    color: s.color,
    loading: s.loading,
    title: s.title,
    content: (s.when || s.detail) && (
      <div className="text-gray-500 text-sm">
        {s.when && <div>{s.when}</div>}
        {s.detail && <div>{s.detail}</div>}
      </div>
    ),
  }))

export default function VoiceTimeline({ profile }: { profile: VoiceProfileListItem }) {
  return (
    <div>
      <h4 className="font-semibold mb-3">Admin review</h4>
      <Timeline items={toItems(reviewSteps(profile))} />
      <h4 className="font-semibold mb-3">Registration</h4>
      <Timeline items={toItems(registrationSteps(profile))} />
    </div>
  )
}
