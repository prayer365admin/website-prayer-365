'use client'

import SiteButton, { siteButtonClassName } from '@/components/common/button'
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
import { ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Result } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import styles from './central-review-detail.module.scss'
import SamplePlayer from './sample-player'
import VoiceTimeline from './timeline'
import { registrationHelp } from './status'

/*
 * S24 voice submission detail (F4VO), one page per voice profile:
 * /dashboard/central/voice-profiles/:voiceId. Admin previews the exact
 * submitted revision and approves ("Approve and register") or rejects with a
 * reason. Registration state is read-only; the Voice ID is never entered manually.
 */

export const formatDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : '—'

const formatNumericDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(iso))
    : '—'

function EvidenceBlock({ profile }: { profile: VoiceProfileDetail }) {
  const { data, loading } = useMediaAccess(profile.churchId, profile.evidenceAssetId)
  if (!profile.evidenceAssetId)
    return <div className={styles.emptyText}>No evidence file attached</div>

  return (
    <div className={styles.evidenceRow}>
      <div aria-hidden="true" className={styles.pdfTile}>
        .pdf
      </div>
      <div className={styles.evidenceDetails}>
        <div className={styles.evidenceName}>
          Terms {profile.termsVersion} · Recorded {formatNumericDate(profile.consentRecordedAt)}
        </div>
        {data ? (
          <a
            aria-label="View signed evidence"
            className={siteButtonClassName({
              asLink: true,
              className: styles.detailXsButton,
              size: 'xs',
              variant: 'outlined',
            })}
            href={data.url}
            rel="noreferrer"
            target="_blank"
          >
            View evidence <ArrowRightOutlined aria-hidden />
          </a>
        ) : (
          <SiteButton
            className={styles.detailXsButton}
            disabled
            icon={<ArrowRightOutlined aria-hidden />}
            iconPlacement="end"
            loading={loading}
            size="xs"
            variant="outlined"
          >
            View evidence
          </SiteButton>
        )}
      </div>
    </div>
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
  const who = `${profile.pastorName} (${profile.churchName})`
  const ref = { id: profile.id, version: profile.version }

  const confirm = (title: string, content: string, okText: string, run: () => Promise<unknown>) =>
    modal.confirm({ title, content, okText, onOk: run })

  return (
    <div className={styles.columns}>
      <section className={styles.detailCard}>
        <h2 className={styles.sectionTitle}>Voice Samples</h2>
        <div className={styles.samples}>
          {profile.samples.length ? (
            profile.samples.map((sample, index) => (
              <SamplePlayer
                assetId={sample.assetId}
                churchId={profile.churchId}
                key={sample.assetId}
                label={`Sample ${index + 1}`}
              />
            ))
          ) : (
            <div className={styles.emptyText}>No voice samples attached</div>
          )}
        </div>

        <h2 className={styles.sectionTitle}>Offline authorization</h2>
        <div className={styles.sectionBody}>
          <EvidenceBlock profile={profile} />
          {profile.consentRevokedAt && (
            <Alert
              className={styles.inlineAlert}
              showIcon
              title={`Consent revoked ${formatDate(profile.consentRevokedAt)}`}
              type="warning"
            />
          )}
        </div>

        <h2 className={styles.sectionTitle}>Registration</h2>
        <div className={styles.sectionBody}>
          {profile.reviewState === 'APPROVED' && profile.registrationState === 'READY' ? (
            <div className={styles.registrationSuccess}>
              <CheckCircleOutlined />
              <span>
                This voice can now be used for prayer audio. Voice ID:{' '}
                {profile.providerVoiceId ?? 'Assigned after registration'}
              </span>
            </div>
          ) : (
            <div className={styles.registrationInfo}>
              {profile.reviewState === 'APPROVED'
                ? registrationHelp(profile.registrationState, profile.lastErrorCode)
                : `Voice ID: ${profile.providerVoiceId ?? 'Assigned after registration'}`}
            </div>
          )}
          {profile.lastErrorCode && (
            <div className={styles.emptyText}>Last error: {profile.lastErrorCode}</div>
          )}
          {canUpdate && canRetry && (
            <Button
              className={styles.retryButton}
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
              type="primary"
            >
              {voiceMissing ? 'Re-create voice' : 'Retry registration'}
            </Button>
          )}
          {canUpdate &&
            profile.registrationState === 'FAILED' &&
            !canRetry &&
            !profile.consentRevokedAt && (
              <Alert
                className={styles.inlineAlert}
                showIcon
                title="A retry cannot fix this failure. The pastor needs to submit a new revision."
                type="info"
              />
            )}
        </div>

        {canUpdate && pending && isSelf && (
          <div className={styles.sectionBody}>
            <Alert showIcon title="You cannot review your own submission." type="info" />
          </div>
        )}

        {canUpdate && pending && !isSelf && (
          <>
            <h2 className={styles.sectionTitle}>Review decision</h2>
            <div className={styles.sectionBody}>
              <label className={styles.reasonField}>
                <span>Reason — required when rejecting</span>
                <Input.TextArea
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain what needs correction"
                  rows={2}
                  value={reason}
                />
              </label>
              <div className={styles.actionRow}>
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
                  type="primary"
                >
                  Approve and register
                </Button>
              </div>
              <p className={styles.helpText}>
                Approval automatically queues registration. You cannot approve your own sample.
              </p>
            </div>
          </>
        )}

        {canUpdate && canStop && (
          <>
            <h2 className={styles.sectionTitle}>Voice Controls</h2>
            <div
              className={`${styles.sectionBody} ${styles.actionRow} ${styles.voiceControlsActions}`}
            >
              <SiteButton
                className={`${styles.detailXsButton} ${styles.voiceControlButton}`}
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
                size="xs"
                variant="outlined"
              >
                Disable voice
              </SiteButton>
              {!profile.consentRevokedAt && (
                <SiteButton
                  className={`${styles.detailXsButton} ${styles.voiceControlButton}`}
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
                  size="xs"
                  variant="outlined"
                >
                  Revoke consent
                </SiteButton>
              )}
            </div>
          </>
        )}
      </section>

      <aside className={styles.statusCard}>
        <h2 className={styles.sectionTitle}>Submission status</h2>
        <div className={styles.timelineBody}>
          <VoiceTimeline profile={profile} />
        </div>
      </aside>
    </div>
  )
}

const skeletonWaveHeights = [12, 25, 18, 34, 22, 40, 16, 30, 20, 36, 14, 27, 19, 33, 23, 38]

function SamplePlayerSkeleton() {
  return (
    <div className={styles.sampleSkeleton}>
      <span className={`${styles.skeletonBlock} ${styles.sampleLabelSkeleton}`} />
      <div aria-hidden="true" className={styles.waveSkeleton}>
        {skeletonWaveHeights.map((height, index) => (
          <span key={`${height}-${index}`} style={{ height }} />
        ))}
      </div>
      <div className={styles.sampleControlsSkeleton}>
        <span className={`${styles.skeletonBlock} ${styles.circleSkeleton}`} />
        <span className={`${styles.skeletonBlock} ${styles.timeSkeleton}`} />
        <span className={`${styles.skeletonBlock} ${styles.rateSkeleton}`} />
        <span className={`${styles.skeletonBlock} ${styles.downloadSkeleton}`} />
      </div>
    </div>
  )
}

function TimelineTrackSkeleton({ rows }: { rows: number }) {
  return (
    <div className={styles.timelineTrackSkeleton}>
      <div className={styles.timelineHeaderSkeleton}>
        <span className={`${styles.skeletonBlock} ${styles.timelineHeaderDotSkeleton}`} />
        <span className={`${styles.skeletonBlock} ${styles.timelineHeadingSkeleton}`} />
      </div>
      <div className={styles.timelineRowsSkeleton}>
        {Array.from({ length: rows }, (_, index) => (
          <div className={styles.timelineRowSkeleton} key={index}>
            <span className={`${styles.skeletonBlock} ${styles.timelineDotSkeleton}`} />
            <div>
              <span className={`${styles.skeletonBlock} ${styles.timelineTitleSkeleton}`} />
              <span className={`${styles.skeletonBlock} ${styles.timelineMetaSkeleton}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VoiceProfileDetailSkeleton() {
  return (
    <div
      aria-label="Loading voice profile details"
      aria-live="polite"
      className={styles.columns}
      role="status"
    >
      <section className={styles.detailCard}>
        <h2 className={styles.sectionTitle}>Voice Samples</h2>
        <div className={styles.samples}>
          <SamplePlayerSkeleton />
          <SamplePlayerSkeleton />
        </div>

        <h2 className={styles.sectionTitle}>Offline authorization</h2>
        <div className={styles.sectionBody}>
          <div className={styles.evidenceRow}>
            <span className={`${styles.skeletonBlock} ${styles.pdfSkeleton}`} />
            <div className={styles.evidenceSkeletonDetails}>
              <span className={`${styles.skeletonBlock} ${styles.evidenceTextSkeleton}`} />
              <span className={`${styles.skeletonBlock} ${styles.evidenceButtonSkeleton}`} />
            </div>
          </div>
        </div>

        <h2 className={styles.sectionTitle}>Registration</h2>
        <div className={styles.sectionBody}>
          <span className={`${styles.skeletonBlock} ${styles.registrationSkeleton}`} />
        </div>

        <h2 className={styles.sectionTitle}>Voice Controls</h2>
        <div className={`${styles.sectionBody} ${styles.skeletonActions}`}>
          <span className={`${styles.skeletonBlock} ${styles.actionSkeleton}`} />
          <span className={`${styles.skeletonBlock} ${styles.actionSkeleton}`} />
        </div>
      </section>

      <aside className={styles.statusCard}>
        <h2 className={styles.sectionTitle}>Submission status</h2>
        <div className={styles.timelineBody}>
          <div className={styles.timelineSkeleton}>
            <TimelineTrackSkeleton rows={4} />
            <TimelineTrackSkeleton rows={4} />
          </div>
        </div>
      </aside>
    </div>
  )
}

export default function ContentsVoiceReviewDetail({ voiceId }: { voiceId: string }) {
  const router = useRouter()
  const { data, loading, error } = useCentralVoiceProfile(voiceId)
  const status = axios.isAxiosError(error) ? error.response?.status : undefined

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button
          aria-label="Back to voice profiles"
          className={styles.backButton}
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeftOutlined />
        </button>
        <div className={styles.headerText}>
          {data ? (
            <div className={styles.eyebrow}>
              <span>Submitted {formatNumericDate(data.submittedAt)}</span>
              <span aria-hidden="true">•</span>
              <span>{data.churchName}</span>
            </div>
          ) : !error && loading ? (
            <div aria-hidden="true" className={styles.skeletonHeaderMeta}>
              <span className={`${styles.skeletonBlock} ${styles.headerDateSkeleton}`} />
              <span className={`${styles.skeletonBlock} ${styles.headerChurchSkeleton}`} />
            </div>
          ) : null}
          <h1 aria-label={!data && !error && loading ? 'Loading voice submission' : undefined}>
            {data?.pastorName ??
              (!error && loading ? (
                <span
                  aria-hidden="true"
                  className={`${styles.skeletonBlock} ${styles.headerTitleSkeleton}`}
                />
              ) : (
                'Voice submission'
              ))}
          </h1>
        </div>
      </header>

      <main className={styles.content}>
        {!data && !error && loading ? (
          <VoiceProfileDetailSkeleton />
        ) : data ? (
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
      </main>
    </div>
  )
}
