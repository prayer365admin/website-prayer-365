import { Tag } from 'antd'

/*
 * F4VO VO-06 — review state and provider registration state are separate and
 * always shown as two labelled tags (text + color, never color alone).
 * Registration is read-only everywhere: no action buttons here.
 */

const REVIEW: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'default' },
  SUBMITTED: { label: 'Submitted', color: 'processing' },
  APPROVED: { label: 'Approved', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
}

const REGISTRATION: Record<string, { label: string; color: string; help: string }> = {
  UNREGISTERED: {
    label: 'Not registered',
    color: 'default',
    help: 'Registration starts automatically after an admin approves the submission.',
  },
  QUEUED: {
    label: 'Queued',
    color: 'processing',
    help: 'Approved. Waiting for voice registration to start.',
  },
  REGISTERING: {
    label: 'Registering',
    color: 'processing',
    help: 'The voice is being registered with the provider.',
  },
  VERIFICATION_REQUIRED: {
    label: 'Verification required',
    color: 'warning',
    help: 'Provider verification is required before this voice can be used. Generation stays blocked; PRAYER support will contact you.',
  },
  READY: { label: 'Ready', color: 'success', help: 'This voice can be used for prayer audio.' },
  FAILED: {
    label: 'Failed',
    color: 'error',
    help: 'Registration failed. An admin can review the error.',
  },
  REGISTRATION_UNKNOWN: {
    label: 'Check registration result',
    color: 'warning',
    help: 'The provider did not confirm the registration in time. PRAYER is checking the result; no action is needed.',
  },
  DISABLED: {
    label: 'Disabled',
    color: 'default',
    help: 'This voice is disabled and cannot be used for new prayer audio.',
  },
}

export const ReviewStateTag = ({ state }: { state: string }) => {
  const s = REVIEW[state] ?? { label: state, color: 'default' }
  return <Tag color={s.color}>Admin review: {s.label}</Tag>
}

export const RegistrationStateTag = ({ state }: { state: string }) => {
  const s = REGISTRATION[state] ?? { label: state, color: 'default' }
  return <Tag color={s.color}>Registration: {s.label}</Tag>
}

/** One line of read-only guidance for the current registration state. */
export const registrationHelp = (state: string, lastErrorCode?: string | null): string => {
  if (lastErrorCode === 'PROVIDER_VOICE_MISSING')
    return 'This voice no longer exists at the provider. An admin can re-create it from the approved samples.'
  return REGISTRATION[state]?.help ?? ''
}

export const reviewLabel = (state: string) => REVIEW[state]?.label ?? state
export const registrationLabel = (state: string) => REGISTRATION[state]?.label ?? state
