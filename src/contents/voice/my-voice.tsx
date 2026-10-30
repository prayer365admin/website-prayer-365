'use client'

import SiteButton from '@/components/common/button'
import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { AudioWavePlayerSkeleton } from '@/components/common/audio-wave-player'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useMediaUpload } from '@/hooks/data/media-upload'
import {
  useCreateVoiceConsent,
  useCreateVoiceSubmission,
  useMyVoiceChurches,
  useMyVoiceSubmissions,
  usePatchVoiceSubmission,
  useSubmitVoiceSubmission,
} from '@/hooks/data/voice'
import { VOICE_SAMPLE_MAX_FILES, VoiceProfileListItem } from '@/models/voice'
import { VOICE_CONSENT_TERMS_VERSION } from '@/utils/constant'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Drawer, Modal, Result, Select, Upload } from 'antd'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import RecordingTips from './recording-tips'
import SamplePlayer, { formatDuration } from './sample-player'
import { RegistrationStateTag, ReviewStateTag, registrationHelp } from './status'
import VoiceTimeline from './timeline'
import styles from './my-voice.module.scss'

const CENTRAL_VOICE_PROFILES = '/dashboard/central/voice-profiles'
type Sample = { assetId: string; name: string }

const durationHint = (seconds: number) => {
  if (seconds === 0)
    return {
      type: 'warning' as const,
      text: 'Add at least 1 minute long audio for a better result.',
    }
  if (seconds < 60)
    return { type: 'warning' as const, text: 'Under 1 minute. Add more audio for a better clone.' }
  if (seconds > 180)
    return {
      type: 'warning' as const,
      text: 'Over 3 minutes. Extra length adds little and can make the clone worse.',
    }
  return { type: 'success' as const, text: 'Good length.' }
}

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(value))
    : null

const evidenceFormat = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension && ['pdf', 'png', 'jpg', 'jpeg'].includes(extension) ? `.${extension}` : 'file'
}

function SampleList({
  churchId,
  samples,
  onRemove,
  onDuration,
}: {
  churchId: string
  samples: Sample[]
  onRemove?: (assetId: string) => void
  onDuration?: (assetId: string, seconds: number) => void
}) {
  return (
    <div className={styles.sampleList}>
      {samples.map((sample) => (
        <div
          className={`${styles.sampleRow} ${onRemove ? styles.editableSampleRow : ''}`}
          key={sample.assetId}
        >
          <SamplePlayer
            assetId={sample.assetId}
            churchId={churchId}
            label={sample.name}
            onDuration={onDuration}
          />
          {onRemove && (
            <button
              aria-label={`Remove ${sample.name}`}
              className={styles.removeSample}
              onClick={() => onRemove(sample.assetId)}
              type="button"
            >
              <DeleteOutlined aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function DraftForm({
  draft,
  churchId,
  replacesProfileId,
  onCancel,
  onSaved,
  onSubmitted,
}: {
  draft: VoiceProfileListItem | null
  churchId: string
  replacesProfileId?: string
  onCancel: () => void
  onSaved: () => void
  onSubmitted: () => void
}) {
  const { notification } = App.useApp()
  const [samples, setSamples] = useState<Sample[]>(
    draft?.samples.map((sample, index) => ({
      assetId: sample.assetId,
      name: `Sample ${index + 1}`,
    })) ?? [],
  )
  const [evidence, setEvidence] = useState<{ assetId: string; name: string } | null>(null)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)
  const [activeAction, setActiveAction] = useState<'save' | 'submit' | null>(null)
  const { onUpload: uploadSample, loading: sampleUploading } = useMediaUpload({
    churchId,
    purpose: 'VOICE_SAMPLE',
  })
  const { onUpload: uploadEvidence, loading: evidenceUploading } = useMediaUpload({
    churchId,
    purpose: 'CONSENT_EVIDENCE',
  })
  const { onCreateConsent, loading: consentLoading } = useCreateVoiceConsent()
  const { onCreate, loading: createLoading } = useCreateVoiceSubmission()
  const { onPatch, loading: patchLoading } = usePatchVoiceSubmission()
  const { onSubmit, loading: submitLoading } = useSubmitVoiceSubmission()
  const mutationLoading = consentLoading || createLoading || patchLoading || submitLoading
  const busy = activeAction !== null || mutationLoading

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const totalSeconds = samples.reduce((sum, sample) => sum + (durations[sample.assetId] ?? 0), 0)
  const hint = durationHint(totalSeconds)
  const missingEvidence = !draft && !evidence

  const save = async () => {
    const consentId = evidence
      ? (
          await onCreateConsent({
            evidenceAssetId: evidence.assetId,
            termsVersion: VOICE_CONSENT_TERMS_VERSION,
          })
        ).id
      : undefined
    const sampleAssetIds = samples.map((sample) => sample.assetId)
    const saved = draft
      ? await onPatch({
          id: draft.id,
          version: draft.version,
          sampleAssetIds,
          ...(consentId ? { consentId } : {}),
        })
      : await onCreate({
          sampleAssetIds,
          consentId: consentId as string,
          churchId,
          ...(replacesProfileId ? { replacesProfileId } : {}),
        })
    setDirty(false)
    return saved
  }

  const handleSave = async () => {
    setActiveAction('save')
    try {
      await save()
      onSaved()
    } catch {
      // The mutation hook presents the contextual error notification.
    } finally {
      setActiveAction(null)
    }
  }
  const handleSubmit = async () => {
    setActiveAction('submit')
    try {
      const saved = dirty || !draft ? await save() : draft
      await onSubmit({ id: saved.id, version: saved.version })
      onSubmitted()
    } catch {
      // The mutation hook presents the contextual error notification.
    } finally {
      setActiveAction(null)
    }
  }
  const uploadRequest =
    (
      upload: (file: File) => Promise<{ assetId: string }>,
      onDone: (assetId: string, name: string) => void,
    ) =>
    async ({
      file,
      onSuccess,
      onError,
    }: {
      file: unknown
      onSuccess?: (body: unknown) => void
      onError?: (error: Error) => void
    }) => {
      try {
        const selectedFile = file as File
        const result = await upload(selectedFile)
        onDone(result.assetId, selectedFile.name)
        setDirty(true)
        onSuccess?.(result)
      } catch (error) {
        if (!axios.isAxiosError(error))
          notification.error({ title: 'Upload Failed', description: 'Please try another file.' })
        onError?.(error as Error)
      }
    }

  return (
    <div className={styles.drawerForm}>
      <div className={styles.drawerScrollArea}>
        {replacesProfileId && (
          <Alert
            className={styles.revisionNotice}
            icon={<InfoCircleOutlined />}
            showIcon
            title="Your current voice stays active until the new one is approved and ready."
            type="info"
          />
        )}
        <section className={styles.formPanel}>
          <div className={styles.panelHeading}>
            <strong>Voice samples</strong>
            <RecordingTips />
          </div>
          <div className={styles.panelBody}>
            <Alert
              className={styles.durationAlert}
              icon={<ExclamationCircleOutlined />}
              showIcon
              title={hint.text}
              type={hint.type}
            />
            <SampleList
              churchId={churchId}
              samples={samples}
              onDuration={(assetId, seconds) =>
                setDurations((current) => ({ ...current, [assetId]: seconds }))
              }
              onRemove={(assetId) => {
                setSamples((current) => current.filter((sample) => sample.assetId !== assetId))
                setDirty(true)
              }}
            />
            <div className={styles.uploadRow}>
              <Upload
                accept="audio/*"
                customRequest={uploadRequest(uploadSample, (assetId, name) =>
                  setSamples((current) => [...current, { assetId, name }]),
                )}
                disabled={samples.length >= VOICE_SAMPLE_MAX_FILES || busy}
                showUploadList={false}
              >
                <Button
                  disabled={samples.length >= VOICE_SAMPLE_MAX_FILES || busy}
                  icon={<UploadOutlined />}
                  iconPosition="end"
                  loading={sampleUploading}
                >
                  Add audio file
                </Button>
              </Upload>
              <span>
                {samples.length}/{VOICE_SAMPLE_MAX_FILES} files
                {totalSeconds > 0 && ` · ${formatDuration(totalSeconds)} total`}
              </span>
            </div>
            <p className={styles.recordingGuidance}>
              Use 1–2 minutes of clear prayer-style speech in total. One speaker, no music and
              minimal echo.
            </p>
          </div>
        </section>

        <section className={styles.formPanel}>
          <div className={styles.panelHeading}>
            <strong>Offline authorization evidence</strong>
          </div>
          <div className={styles.evidenceBody}>
            {evidence ? (
              <div className={styles.evidenceFile}>
                <span className={styles.fileBadge}>{evidenceFormat(evidence.name)}</span>
                <div>
                  <div className={styles.fileName}>{evidence.name}</div>
                  <Upload
                    accept="application/pdf,image/jpeg,image/png"
                    customRequest={uploadRequest(uploadEvidence, (assetId, name) =>
                      setEvidence({ assetId, name }),
                    )}
                    disabled={busy}
                    showUploadList={false}
                  >
                    <Button icon={<UploadOutlined />} loading={evidenceUploading}>
                      Change
                    </Button>
                  </Upload>
                </div>
              </div>
            ) : (
              <Upload
                accept="application/pdf,image/jpeg,image/png"
                customRequest={uploadRequest(uploadEvidence, (assetId, name) =>
                  setEvidence({ assetId, name }),
                )}
                disabled={busy}
                showUploadList={false}
              >
                <button className={styles.evidenceUpload} disabled={busy} type="button">
                  <span className={styles.uploadTile}>
                    <UploadOutlined aria-hidden />
                    Upload
                  </span>
                  <span>
                    <strong>{draft ? 'Replace signed evidence' : 'Choose signed evidence'}</strong>
                    <small>PDF, JPG or PNG</small>
                  </span>
                </button>
              </Upload>
            )}
            {draft && !evidence && (
              <span className={styles.attachedEvidence}>Authorization evidence attached</span>
            )}
          </div>
        </section>
      </div>

      <footer className={styles.drawerFooter}>
        <SiteButton
          className={styles.cancelButton}
          disabled={busy}
          onClick={onCancel}
          size="sm"
          variant="outlined"
        >
          Cancel
        </SiteButton>
        <div className={styles.primaryActions}>
          <SiteButton
            disabled={samples.length === 0 || missingEvidence || (!!draft && !dirty) || busy}
            icon={
              <span aria-hidden="true">
                <EditOutlined />
              </span>
            }
            iconPlacement="end"
            loading={activeAction === 'save'}
            onClick={handleSave}
            size="sm"
            variant="outlined"
          >
            Save draft
          </SiteButton>
          <SiteButton
            disabled={samples.length === 0 || missingEvidence || busy}
            icon={
              <span aria-hidden="true">
                <CheckOutlined />
              </span>
            }
            iconPlacement="end"
            loading={activeAction === 'submit'}
            onClick={handleSubmit}
            size="sm"
          >
            Submit for review
          </SiteButton>
        </div>
      </footer>
    </div>
  )
}

function StatusCard({ profile }: { profile: VoiceProfileListItem | null }) {
  return (
    <aside className={styles.statusCard}>
      <h2>Submission status</h2>
      <div className={styles.statusContent}>
        {profile ? (
          <>
            <VoiceTimeline profile={profile} />
            {profile.reviewState === 'REJECTED' && profile.reviewReason && (
              <Alert
                description={profile.reviewReason}
                showIcon
                title="Rejected by the reviewer"
                type="error"
              />
            )}
            {profile.reviewState === 'APPROVED' && profile.registrationState === 'READY' && (
              <Alert
                className={styles.readyAlert}
                showIcon
                title="This voice can now be used for prayer audio"
                type="success"
              />
            )}
            {profile.reviewState === 'APPROVED' && profile.registrationState !== 'READY' && (
              <p className={styles.registrationHelp}>
                {registrationHelp(profile.registrationState, profile.lastErrorCode)}
              </p>
            )}
          </>
        ) : (
          <p className={styles.emptyStatus}>Nothing submitted yet.</p>
        )}
        <section className={styles.nextPanel}>
          <h3>What happens next</h3>
          <div>
            <p>
              After you submit, an admin reviews your samples and authorization. Approval starts
              voice registration automatically. If rejected, the reason appears here and you can
              submit a corrected sample.
            </p>
            <p>
              If provider verification is required, your voice stays unavailable until that step is
              completed.
            </p>
          </div>
        </section>
      </div>
    </aside>
  )
}

function CurrentSubmission({
  profile,
  onRevise,
  actionLabel = 'Start new revision',
}: {
  profile: VoiceProfileListItem
  onRevise?: () => void
  actionLabel?: string
}) {
  return (
    <article className={styles.voiceCard}>
      <header className={styles.profileHeader}>
        <h2>{profile.pastorName}</h2>
        <p>
          {profile.submittedAt && (
            <>
              Submitted {formatDate(profile.submittedAt)} <span>•</span>{' '}
            </>
          )}
          {profile.churchName} <span>•</span> Your linked profile
        </p>
      </header>
      <div className={styles.currentSamples}>
        <SampleList
          churchId={profile.churchId}
          samples={profile.samples.map((sample, index) => ({
            assetId: sample.assetId,
            name: `Sample ${index + 1}`,
          }))}
        />
        {onRevise && (
          <SiteButton
            className={styles.revisionButton}
            icon={
              <span aria-hidden className={styles.plusIcon}>
                +
              </span>
            }
            iconPlacement="end"
            onClick={onRevise}
            size="sm"
            variant="outlined"
          >
            {actionLabel}
          </SiteButton>
        )}
      </div>
    </article>
  )
}

function RevisionHistory({ submissions }: { submissions: VoiceProfileListItem[] }) {
  if (submissions.length <= 1) return null
  return (
    <section className={styles.history}>
      <h2>
        Earlier revision <span>({submissions.length - 1})</span>
      </h2>
      <div className={styles.historyList}>
        {submissions.slice(1).map((profile) => (
          <div className={styles.historyItem} key={profile.id}>
            <div>
              <span>{formatDate(profile.createdAt)}</span>
              <ReviewStateTag state={profile.reviewState} />
              <RegistrationStateTag state={profile.registrationState} />
            </div>
            {profile.reviewReason && <p>{profile.reviewReason}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function TimelineTrackSkeleton({ rows = 3 }: { rows?: number }) {
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

function MyVoiceContentSkeleton() {
  return (
    <div
      aria-label="Loading My Voice content"
      aria-live="polite"
      className={styles.grid}
      role="status"
    >
      <div className={styles.leftColumn}>
        <article className={styles.voiceCard}>
          <header className={`${styles.profileHeader} ${styles.profileHeaderSkeleton}`}>
            <span className={`${styles.skeletonBlock} ${styles.profileNameSkeleton}`} />
            <span className={`${styles.skeletonBlock} ${styles.profileMetaSkeleton}`} />
          </header>
          <div className={styles.currentSamples}>
            <div className={styles.sampleList}>
              <AudioWavePlayerSkeleton label="voice sample 1" />
              <AudioWavePlayerSkeleton label="voice sample 2" />
            </div>
            <span className={`${styles.skeletonBlock} ${styles.revisionButtonSkeleton}`} />
          </div>
        </article>
        <section className={styles.history}>
          <div className={styles.historyHeadingSkeleton}>
            <span className={`${styles.skeletonBlock} ${styles.historyTitleSkeleton}`} />
          </div>
          <div className={styles.historyItemSkeleton}>
            <span className={`${styles.skeletonBlock} ${styles.historyDateSkeleton}`} />
            <span className={`${styles.skeletonBlock} ${styles.historyTagSkeleton}`} />
          </div>
        </section>
      </div>

      <aside className={styles.statusCard}>
        <h2>Submission status</h2>
        <div className={styles.statusContent}>
          <TimelineTrackSkeleton rows={4} />
          <TimelineTrackSkeleton rows={3} />
          <span className={`${styles.skeletonBlock} ${styles.readyBannerSkeleton}`} />
          <section className={styles.nextPanel}>
            <h3>What happens next</h3>
            <div className={styles.nextCopySkeleton}>
              <span className={`${styles.skeletonBlock} ${styles.copyLineSkeleton}`} />
              <span className={`${styles.skeletonBlock} ${styles.copyLineSkeleton}`} />
              <span className={`${styles.skeletonBlock} ${styles.shortCopyLineSkeleton}`} />
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}

export default function ContentsMyVoice() {
  const router = useRouter()
  const { data: submissions, loading, error } = useMyVoiceSubmissions()
  const { data: churches, loading: churchesLoading } = useMyVoiceChurches()
  const [startNew, setStartNew] = useState(false)
  const [drawerDismissed, setDrawerDismissed] = useState(false)
  const [selectedChurchId, setSelectedChurchId] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const unlinked =
    axios.isAxiosError(error) &&
    (error.response?.status === 403 || error.response?.data?.error_code === 'UNLINKED_PASTOR')
  const canReviewVoices = useAccessPermission().readAny('prayer_voice_profile').granted
  const latest = submissions[0] ?? null
  const draft = latest?.reviewState === 'DRAFT' ? latest : null
  const canRevise = latest?.reviewState === 'REJECTED' || latest?.reviewState === 'APPROVED'
  const shouldOpenExisting = !!draft || (!loading && !latest && !error && !!churches?.length)
  const drawerOpen = startNew || (shouldOpenExisting && !drawerDismissed)
  const churchId =
    draft?.churchId ?? selectedChurchId ?? latest?.churchId ?? churches?.[0]?.id ?? ''
  const replacesProfileId =
    latest?.reviewState === 'APPROVED' ? latest.id : (latest?.replacesProfileId ?? undefined)

  if (unlinked)
    return (
      <Result
        status="info"
        title="Your account is not linked to a pastor profile"
        subTitle="Ask a central administrator to link your staff account to your pastor profile."
        extra={
          canReviewVoices ? (
            <Button type="primary" onClick={() => router.push(CENTRAL_VOICE_PROFILES)}>
              Review voice profiles in Central
            </Button>
          ) : undefined
        }
      />
    )

  return (
    <section className={styles.page}>
      <DashboardMainHeader description="Submit your sample for admin approval." title="My Voice" />
      {error && (
        <Alert
          className={styles.loadError}
          description="Refresh the page or try again shortly."
          showIcon
          title="Your voice submissions could not be loaded"
          type="error"
        />
      )}
      {!loading && !latest && !churchesLoading && !churches?.length && (
        <Alert
          description="Ask a central administrator to assign your pastor profile to a church before submitting a voice."
          showIcon
          title="You are not assigned as a pastor of any church yet"
          type="warning"
        />
      )}
      {loading ? (
        <MyVoiceContentSkeleton />
      ) : (
        <div className={styles.grid}>
          <div className={styles.leftColumn}>
            {latest ? (
              <CurrentSubmission
                actionLabel={draft ? 'Continue editing draft' : undefined}
                profile={latest}
                onRevise={
                  draft || canRevise
                    ? () => {
                        setDrawerDismissed(false)
                        setStartNew(true)
                      }
                    : undefined
                }
              />
            ) : (
              <article className={styles.emptyCard}>
                <h2>No voice submitted yet</h2>
                <p>Add a clear voice sample and authorization evidence to begin.</p>
                {!!churches?.length && (
                  <SiteButton
                    onClick={() => {
                      setDrawerDismissed(false)
                      setStartNew(true)
                    }}
                    size="sm"
                  >
                    Add new voice
                  </SiteButton>
                )}
              </article>
            )}
            <RevisionHistory submissions={submissions} />
          </div>
          <StatusCard profile={latest} />
        </div>
      )}

      <Drawer
        className={styles.voiceDrawer}
        closeIcon={<CloseOutlined />}
        destroyOnHidden
        footer={null}
        onClose={() => {
          setDrawerDismissed(true)
          setStartNew(false)
        }}
        open={drawerOpen}
        placement="right"
        rootClassName={styles.voiceDrawerRoot}
        title={
          <div className={styles.drawerTitle}>
            <strong>{draft ? 'Edit voice draft' : 'Add new voice'}</strong>
            <span>Upload new voice samples</span>
          </div>
        }
        size={576}
      >
        {churches && churches.length > 1 && !draft && (
          <Select
            aria-label="Church"
            className={styles.churchSelect}
            onChange={setSelectedChurchId}
            options={churches.map((church) => ({ label: church.name, value: church.id }))}
            value={churchId || undefined}
          />
        )}
        {churchId && (
          <DraftForm
            churchId={churchId}
            draft={draft}
            key={draft ? `${draft.id}:${draft.version}` : `new:${churchId}`}
            onCancel={() => {
              setDrawerDismissed(true)
              setStartNew(false)
            }}
            onSaved={() => {
              setDrawerDismissed(true)
              setStartNew(false)
            }}
            onSubmitted={() => {
              setDrawerDismissed(true)
              setStartNew(false)
              setSubmitted(true)
            }}
            replacesProfileId={draft ? undefined : replacesProfileId}
          />
        )}
      </Drawer>

      <Modal
        centered
        className={styles.successModal}
        closable={false}
        footer={null}
        onCancel={() => setSubmitted(false)}
        open={submitted}
        width={576}
      >
        <div className={styles.successContent}>
          <span className={styles.successIcon}>
            <CheckOutlined aria-hidden />
          </span>
          <h2>Voice submitted for review</h2>
          <p>Your current voice stays active until the new one is approved and ready.</p>
          <SiteButton
            icon={
              <span aria-hidden="true">
                <CheckOutlined />
              </span>
            }
            iconPlacement="end"
            onClick={() => setSubmitted(false)}
            size="md"
          >
            Got it
          </SiteButton>
        </div>
      </Modal>
    </section>
  )
}
