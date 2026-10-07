'use client'

import CardTitle from '@/components/common/card-title'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useMediaAccess } from '@/hooks/data/media-access'
import {
  useApproveVoiceProfile,
  useCentralVoiceProfile,
  useDisableVoiceProfile,
  useRejectVoiceProfile,
  useRecloneVoiceProfile,
  useRevokeVoiceConsent,
} from '@/hooks/data/voice'
import { VoiceProfileDetail, canRetryRegistration } from '@/models/voice'
import { Alert, App, Button, Card, Col, Input, Result, Row } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import RecordingTips from './recording-tips'
import SamplePlayer, { formatDuration } from './sample-player'
import VoiceTimeline from './timeline'
import { registrationHelp } from './status'

/*
 * S24 voice submission detail (F4VO), one page per voice profile:
 * /dashboard/central/voice-profiles/:voiceId. Admin previews the exact
 * submitted revision and approves ("Approve and register") or rejects with a
 * reason. Registration state is read-only; the Voice ID is never entered manually.
 */

export const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

function EvidenceLink({ churchId, assetId }: { churchId: string; assetId: string | null }) {
  const { data, loading } = useMediaAccess(churchId, assetId)
  if (!assetId) return <span className="text-gray-500">No evidence file attached</span>
  return (
    <Button href={data?.url} target="_blank" rel="noreferrer" loading={loading} disabled={!data}>
      View signed evidence
    </Button>
  )
}

export function ReviewPanel({ profile }: { profile: VoiceProfileDetail }) {
  const { modal } = App.useApp()
  const { data: session } = useSession()
  const permission = useAccessPermission()
  const canUpdate = permission.updateAny('prayer_voice_profile').granted
  const userId = session?.user.user_id
  const isSelf = !!userId && (profile.submittedBy === userId || profile.pastorUserId === userId)

  const [reason, setReason] = useState('')
  const [durations, setDurations] = useState<Record<string, number>>({})
  const { onApprove, loading: approving } = useApproveVoiceProfile()
  const { onReject, loading: rejecting } = useRejectVoiceProfile()
  const { onDisable, loading: disabling } = useDisableVoiceProfile()
  const { onRevokeConsent, loading: revoking } = useRevokeVoiceConsent()
  const { onReclone, loading: recloning } = useRecloneVoiceProfile()
  const busy = approving || rejecting || disabling || revoking || recloning
  const voiceMissing = profile.lastErrorCode === 'PROVIDER_VOICE_MISSING'
  const canRetry = canRetryRegistration(profile)

  const pending = profile.reviewState === 'SUBMITTED'
  const canStop = profile.reviewState === 'APPROVED' && profile.registrationState !== 'DISABLED'
  const totalSeconds = profile.samples.reduce((sum, s) => sum + (durations[s.assetId] ?? 0), 0)
  const who = `${profile.pastorName} (${profile.churchName})`
  const ref = { id: profile.id, version: profile.version }

  const confirm = (title: string, content: string, okText: string, run: () => Promise<unknown>) =>
    modal.confirm({ title, content, okText, onOk: run })

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={15}>
        <div className="space-y-5">
          <div className="text-gray-500">
            {profile.churchName} / Submitted {formatDate(profile.submittedAt)}
            {profile.replacesProfileId && ' / Replaces an earlier voice'}
          </div>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-base m-0">Voice samples</h3>
              <RecordingTips />
            </div>
            <div className="space-y-2">
              {profile.samples.map((s, i) => (
                <div key={s.assetId} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-20">Sample {i + 1}</span>
                  <SamplePlayer
                    churchId={profile.churchId}
                    assetId={s.assetId}
                    onDuration={(assetId, seconds) =>
                      setDurations((d) => ({ ...d, [assetId]: seconds }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="text-gray-500 mt-2">
              {profile.samples.length} file{profile.samples.length === 1 ? '' : 's'}
              {totalSeconds > 0 && ` · ${formatDuration(totalSeconds)} total`} · Private samples
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">Offline authorization</h3>
            <EvidenceLink churchId={profile.churchId} assetId={profile.evidenceAssetId} />
            <div className="text-gray-500 mt-2">
              Terms {profile.termsVersion} · Recorded {formatDate(profile.consentRecordedAt)}
            </div>
            {profile.consentRevokedAt && (
              <Alert
                className="mt-2"
                type="warning"
                showIcon
                title={`Consent revoked ${formatDate(profile.consentRevokedAt)}`}
              />
            )}
          </section>

          <section className="space-y-2">
            {profile.reviewState === 'APPROVED' && (
              <p className="m-0">
                {registrationHelp(profile.registrationState, profile.lastErrorCode)}
              </p>
            )}
            <div className="text-gray-500">
              Voice ID: {profile.providerVoiceId ?? 'Assigned after registration'}
            </div>
            {profile.lastErrorCode && (
              <div className="text-gray-500">Last error: {profile.lastErrorCode}</div>
            )}
          </section>

          {canUpdate && pending && isSelf && (
            <Alert type="info" showIcon title="You cannot review your own submission." />
          )}

          {canUpdate && pending && !isSelf && (
            <section className="space-y-3">
              <label className="block">
                <span className="font-semibold">Reason — required when rejecting</span>
                <Input.TextArea
                  className="mt-1"
                  rows={2}
                  maxLength={500}
                  placeholder="Explain what needs correction"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!reason.trim() || busy}
                  loading={rejecting}
                  onClick={() =>
                    confirm(
                      'Reject this submission?',
                      `${who} will see your reason and can submit a corrected sample.`,
                      'Reject',
                      () => onReject({ ...ref, reason: reason.trim() }),
                    )
                  }
                >
                  Reject
                </Button>
                <Button
                  type="primary"
                  disabled={busy}
                  loading={approving}
                  onClick={() =>
                    confirm(
                      'Approve and register?',
                      `Approving ${who} sends these samples to the PRAYER ElevenLabs account to create the voice.`,
                      'Approve and register',
                      () => onApprove(ref),
                    )
                  }
                >
                  Approve and register
                </Button>
              </div>
              <p className="text-gray-500 m-0">
                Approval automatically queues registration. You cannot approve your own sample.
              </p>
            </section>
          )}

          {canUpdate && canRetry && (
            <section>
              <Button
                type="primary"
                disabled={busy}
                loading={recloning}
                onClick={() =>
                  confirm(
                    voiceMissing ? 'Re-create this voice?' : 'Retry registration?',
                    voiceMissing
                      ? `ElevenLabs no longer has ${who}'s voice. This creates a new clone from the same approved samples. Prayer audio can be generated again once it is ready.`
                      : `Sends ${who}'s approved samples to ElevenLabs again. Fix the cause first (for example the ElevenLabs plan or voice slots), or it will fail the same way.`,
                    voiceMissing ? 'Re-create voice' : 'Retry registration',
                    () => onReclone({ churchId: profile.churchId, id: profile.id }),
                  )
                }
              >
                {voiceMissing ? 'Re-create voice' : 'Retry registration'}
              </Button>
            </section>
          )}
          {canUpdate &&
            profile.registrationState === 'FAILED' &&
            !canRetry &&
            !profile.consentRevokedAt && (
              <Alert
                type="info"
                showIcon
                title="A retry cannot fix this failure. The pastor needs to submit a new revision."
              />
            )}

          {canUpdate && canStop && (
            <section className="flex flex-wrap gap-3">
              <Button
                danger
                disabled={busy}
                loading={disabling}
                onClick={() =>
                  confirm(
                    'Disable this voice?',
                    `Blocks new prayer audio with ${who}'s voice. Existing audio keeps playing. The clone at ElevenLabs is not deleted.`,
                    'Disable',
                    () => onDisable(ref),
                  )
                }
              >
                Disable voice
              </Button>
              {!profile.consentRevokedAt && (
                <Button
                  danger
                  disabled={busy}
                  loading={revoking}
                  onClick={() =>
                    confirm(
                      'Revoke consent?',
                      `Records that ${who} withdrew permission. Every voice using this consent is disabled permanently; using the voice again needs a new submission. The clone at ElevenLabs is not deleted.`,
                      'Revoke consent',
                      () => onRevokeConsent(ref),
                    )
                  }
                >
                  Revoke consent
                </Button>
              )}
            </section>
          )}
        </div>
      </Col>
      <Col xs={24} lg={9}>
        <Card type="inner" title="History">
          <VoiceTimeline profile={profile} />
        </Card>
      </Col>
    </Row>
  )
}

export default function ContentsVoiceReviewDetail({ voiceId }: { voiceId: string }) {
  const { data, loading, error } = useCentralVoiceProfile(voiceId)
  const status = axios.isAxiosError(error) ? error.response?.status : undefined

  // Same wrapper as the pastor details page: one Card with a back-arrow CardTitle.
  return (
    <Card
      title={<CardTitle title={data ? `Review ${data.pastorName}` : 'Voice submission'} />}
      loading={!data && !error && loading}
    >
      {data ? (
        <ReviewPanel key={`${data.id}:${data.version}`} profile={data} />
      ) : error ? (
        <Result
          status={status === 404 ? '404' : status === 403 ? '403' : 'error'}
          title={
            status === 404
              ? 'Voice submission not found'
              : status === 403
                ? 'You do not have access to voice submissions'
                : 'The voice submission could not be loaded'
          }
        />
      ) : null}
    </Card>
  )
}
