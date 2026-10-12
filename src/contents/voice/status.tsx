import {
  VoiceRegistrationState,
  VoiceReviewState,
  voiceRegistrationStateColors,
  voiceRegistrationStateHelp,
  voiceRegistrationStateLabels,
  voiceReviewStateColors,
  voiceReviewStateLabels,
} from '@/utils/constant'
import { Tag } from 'antd'

/*
 * F4VO VO-06 — review state and provider registration state are separate and
 * always shown as two labelled tags (text + color, never color alone).
 * Registration is read-only everywhere: no action buttons here.
 */

const review = (state: string) => ({
  label: voiceReviewStateLabels[state as VoiceReviewState] ?? state,
  color: voiceReviewStateColors[state as VoiceReviewState] ?? 'default',
})

const registration = (state: string) => ({
  label: voiceRegistrationStateLabels[state as VoiceRegistrationState] ?? state,
  color: voiceRegistrationStateColors[state as VoiceRegistrationState] ?? 'default',
})

export const ReviewStateTag = ({ state }: { state: string }) => {
  const s = review(state)
  return <Tag color={s.color}>Admin review: {s.label}</Tag>
}

export const RegistrationStateTag = ({ state }: { state: string }) => {
  const s = registration(state)
  return <Tag color={s.color}>Registration: {s.label}</Tag>
}

/** One line of read-only guidance for the current registration state. */
export const registrationHelp = (state: string, lastErrorCode?: string | null): string => {
  if (lastErrorCode === 'PROVIDER_VOICE_MISSING')
    return 'This voice no longer exists at the provider. An admin can re-create it from the approved samples.'
  return voiceRegistrationStateHelp[state as VoiceRegistrationState] ?? ''
}

export const reviewLabel = (state: string) => review(state).label
export const registrationLabel = (state: string) => registration(state).label
