import { VoiceProfileListItem, VoiceTimelineEvent } from '@/models/voice'
import { VOICE_TIMELINE_REGISTRATION_STEPS, VOICE_TIMELINE_REVIEW_STEPS } from '@/utils/constant'
import { CheckOutlined } from '@ant-design/icons'
import styles from './timeline.module.scss'
import { registrationLabel } from './status'

/*
 * Two-track history of a voice profile (F4VO): admin review and provider
 * registration, built from audit_logs (no extra schema). The open step at the
 * end is derived from the profile's current state.
 */

type Step = { color: string; title: string; when?: string; detail?: string; loading?: boolean }

const lastWhere = (steps: Step[], test: (s: Step) => boolean) => [...steps].reverse().find(test)

const when = (e: VoiceTimelineEvent) => {
  const date = new Date(e.at)
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric',
  }).format(date)
  return `${formatted} · ${e.actorName ? `by ${e.actorName}` : 'by system'}`
}

const pick = (
  events: VoiceTimelineEvent[],
  steps: Record<string, { title: string; color: string }>,
): Step[] =>
  events.flatMap((e) => {
    const step = steps[`${e.action}:${e.outcome}`] ?? steps[e.action]
    return step ? [{ ...step, when: when(e) }] : []
  })

export const reviewSteps = (p: VoiceProfileListItem): Step[] => {
  const steps = pick(p.timeline ?? [], VOICE_TIMELINE_REVIEW_STEPS)
  const rejected = lastWhere(steps, (s) => s.title === 'Rejected')
  if (rejected && p.reviewReason) rejected.detail = `Reason: ${p.reviewReason}`
  if (p.reviewState === 'DRAFT') steps.push({ color: 'gray', title: 'Not submitted yet' })
  if (p.reviewState === 'SUBMITTED')
    steps.push({ color: 'blue', title: 'Waiting for admin review', loading: true })
  return steps
}

export const registrationSteps = (p: VoiceProfileListItem): Step[] => {
  const steps = pick(p.timeline ?? [], VOICE_TIMELINE_REGISTRATION_STEPS)
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

const markerClass = (color: string) => {
  if (color === 'green') return styles.green
  if (color === 'red') return styles.red
  if (color === 'blue') return styles.blue
  if (color === 'orange') return styles.orange
  return styles.gray
}

function TimelineTrack({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <section className={styles.track}>
      <div className={styles.trackHeader}>
        <span aria-hidden="true" className={styles.headerMarker} />
        <h3>{title}</h3>
      </div>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li className={styles.step} key={`${step.title}-${step.when ?? index}`}>
            <span
              aria-hidden="true"
              className={`${styles.marker} ${markerClass(step.color)} ${step.loading ? styles.loading : ''}`}
            >
              {step.color === 'green' && <CheckOutlined />}
            </span>
            <div className={styles.stepContent}>
              <div className={styles.stepTitle}>{step.title}</div>
              {step.when && <div className={styles.meta}>{step.when}</div>}
              {step.detail && <div className={styles.meta}>{step.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function VoiceTimeline({ profile }: { profile: VoiceProfileListItem }) {
  return (
    <div className={styles.timeline}>
      <TimelineTrack steps={reviewSteps(profile)} title="Admin Review" />
      <TimelineTrack steps={registrationSteps(profile)} title="Registration" />
    </div>
  )
}
