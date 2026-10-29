'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
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
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Collapse, Result, Row, Select, Upload } from 'antd'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessPermission } from '@/hooks/data/access-permission'
import RecordingTips from './recording-tips'
import SamplePlayer, { formatDuration } from './sample-player'
import { RegistrationStateTag, ReviewStateTag, registrationHelp } from './status'
import VoiceTimeline from './timeline'

/** The review queue a non-pastor staff account can actually use (plan 023). */
const CENTRAL_VOICE_PROFILES = '/dashboard/central/voice-profiles'

/*
 * S27 My Voice (F4VO VO-04). Pastor identity comes from the signed-in account.
 * Only a DRAFT is editable; anything submitted is read-only, and a change after
 * review is a new revision that needs its own approval.
 */

type Sample = { assetId: string; name: string }

const durationHint = (seconds: number) => {
  if (seconds === 0) return null
  if (seconds < 60)
    return { type: 'warning' as const, text: 'Under 1 minute. Add more audio for a better clone.' }
  if (seconds > 180)
    return {
      type: 'warning' as const,
      text: 'Over 3 minutes. Extra length adds little and can make the clone worse.',
    }
  return { type: 'success' as const, text: 'Good length.' }
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
    <div className="space-y-2">
      {samples.map((s) => (
        <div key={s.assetId} className="flex flex-wrap items-center gap-3">
          <span className="min-w-32">{s.name}</span>
          <SamplePlayer
            assetId={s.assetId}
            churchId={churchId}
            label={s.name}
            onDuration={onDuration}
          />
          {onRemove && (
            <Button
              size="small"
              icon={<DeleteOutlined />}
              aria-label={`Remove ${s.name}`}
              onClick={() => onRemove(s.assetId)}
            />
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
}: {
  draft: VoiceProfileListItem | null
  churchId: string
  replacesProfileId?: string
  onCancel?: () => void
}) {
  const { modal, notification } = App.useApp()
  const [samples, setSamples] = useState<Sample[]>(
    draft?.samples.map((s, i) => ({ assetId: s.assetId, name: `Sample ${i + 1}` })) ?? [],
  )
  const [evidence, setEvidence] = useState<{ assetId: string; name: string } | null>(null)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [dirty, setDirty] = useState(false)

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
  const saving = consentLoading || createLoading || patchLoading || submitLoading

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const totalSeconds = samples.reduce((sum, s) => sum + (durations[s.assetId] ?? 0), 0)
  const hint = durationHint(totalSeconds)
  const missingEvidence = !draft && !evidence

  const save = async (): Promise<VoiceProfileListItem> => {
    const consentId = evidence
      ? (
          await onCreateConsent({
            evidenceAssetId: evidence.assetId,
            termsVersion: VOICE_CONSENT_TERMS_VERSION,
          })
        ).id
      : undefined
    const sampleAssetIds = samples.map((s) => s.assetId)
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

  const handleSave = () => save().catch(() => undefined)

  const handleSubmit = () =>
    modal.confirm({
      title: 'Submit for review?',
      content:
        'Submitted samples and authorization cannot be changed. Any later change needs a new submission and a new approval.',
      okText: 'Submit for review',
      onOk: async () => {
        const saved = dirty || !draft ? await save() : draft
        await onSubmit({ id: saved.id, version: saved.version })
      },
    })

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
      onSuccess?: (b: unknown) => void
      onError?: (e: Error) => void
    }) => {
      try {
        const f = file as File
        const result = await upload(f)
        onDone(result.assetId, f.name)
        setDirty(true)
        onSuccess?.(result)
      } catch (e) {
        if (!axios.isAxiosError(e))
          notification.error({ title: 'Upload Failed', description: 'Please try another file.' })
        onError?.(e as Error)
      }
    }

  return (
    // Samples and authorization are separate steps, so each gets its own inner card.
    <div className="space-y-4">
      <Card
        type="inner"
        title={
          <span className="flex items-center gap-2">
            Voice samples <RecordingTips />
          </span>
        }
      >
        <SampleList
          churchId={churchId}
          samples={samples}
          onRemove={(assetId) => {
            setSamples((list) => list.filter((s) => s.assetId !== assetId))
            setDirty(true)
          }}
          onDuration={(assetId, seconds) => setDurations((d) => ({ ...d, [assetId]: seconds }))}
        />
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Upload
            accept="audio/*"
            showUploadList={false}
            disabled={samples.length >= VOICE_SAMPLE_MAX_FILES || saving}
            customRequest={uploadRequest(uploadSample, (assetId, name) =>
              setSamples((list) => [...list, { assetId, name }]),
            )}
          >
            <Button
              icon={<UploadOutlined />}
              loading={sampleUploading}
              disabled={samples.length >= VOICE_SAMPLE_MAX_FILES || saving}
            >
              Add audio file
            </Button>
          </Upload>
          <span className="text-gray-500">
            {samples.length}/{VOICE_SAMPLE_MAX_FILES} files
            {totalSeconds > 0 && ` · ${formatDuration(totalSeconds)} total`}
          </span>
        </div>
        <p className="text-gray-500 mt-2 mb-0">
          Use 1–2 minutes of clear prayer-style speech in total. One speaker, no music and minimal
          echo.
        </p>
        {hint && <Alert className="mt-2" type={hint.type} showIcon title={hint.text} />}
      </Card>

      <Card type="inner" title="Offline authorization evidence">
        <div className="flex flex-wrap items-center gap-3">
          <Upload
            accept="application/pdf,image/jpeg,image/png"
            showUploadList={false}
            disabled={saving}
            customRequest={uploadRequest(uploadEvidence, (assetId, name) =>
              setEvidence({ assetId, name }),
            )}
          >
            <Button icon={<UploadOutlined />} loading={evidenceUploading} disabled={saving}>
              {draft || evidence ? 'Replace signed evidence' : 'Choose signed evidence'}
            </Button>
          </Upload>
          <span className="text-gray-500">
            {evidence?.name ?? (draft ? 'Authorization evidence attached' : 'PDF, JPG or PNG')}
          </span>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {onCancel && (
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSave}
          loading={saving}
          disabled={samples.length === 0 || missingEvidence || (!!draft && !dirty)}
        >
          Save draft
        </Button>
        <Button
          type="primary"
          onClick={handleSubmit}
          disabled={samples.length === 0 || missingEvidence || saving}
        >
          Submit for review
        </Button>
      </div>
      {(samples.length === 0 || missingEvidence) && (
        <p className="text-gray-500 m-0">
          Add at least one voice sample and the signed authorization evidence to continue.
        </p>
      )}
    </div>
  )
}

function StatusCard({ profile }: { profile: VoiceProfileListItem | null }) {
  return (
    <Card title="Submission status" className="h-full">
      <div className="space-y-4">
        <Card type="inner" title="Current status">
          {profile ? (
            <div className="space-y-3">
              <VoiceTimeline profile={profile} />
              {profile.reviewState === 'REJECTED' && profile.reviewReason && (
                <Alert
                  type="error"
                  showIcon
                  title="Rejected by the reviewer"
                  description={profile.reviewReason}
                />
              )}
              {profile.reviewState === 'APPROVED' && (
                <p className="m-0">
                  {registrationHelp(profile.registrationState, profile.lastErrorCode)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 m-0">Nothing submitted yet.</p>
          )}
        </Card>
        <Card type="inner" title="What happens next">
          <div className="richtext">
            <p>
              After you submit, an admin reviews your samples and authorization. Approval starts
              voice registration automatically.
            </p>
            <p>If rejected, the reason appears here and you can submit a corrected sample.</p>
            <p>
              If provider verification is required, your voice stays unavailable until that step is
              completed.
            </p>
          </div>
        </Card>
      </div>
    </Card>
  )
}

function ReadOnlyRevision({ profile }: { profile: VoiceProfileListItem }) {
  return (
    <Card type="inner" title="Submitted samples">
      <div className="text-gray-500 mb-2">
        {profile.submittedAt
          ? `Submitted ${new Date(profile.submittedAt).toLocaleDateString()}`
          : 'Not submitted'}{' '}
        · {profile.samples.length} sample{profile.samples.length === 1 ? '' : 's'}
      </div>
      <SampleList
        churchId={profile.churchId}
        samples={profile.samples.map((s, i) => ({ assetId: s.assetId, name: `Sample ${i + 1}` }))}
      />
    </Card>
  )
}

export default function ContentsMyVoice() {
  const router = useRouter()
  const { data: submissions, loading, error } = useMyVoiceSubmissions()
  // Pastor's own assignments (church_pastors), not the role-scoped church list:
  // a pastor has no prayer_church:read.
  const { data: churches, loading: churchesLoading } = useMyVoiceChurches()
  const [startNew, setStartNew] = useState(false)
  const [selectedChurchId, setSelectedChurchId] = useState<string>()

  const unlinked =
    axios.isAxiosError(error) &&
    (error.response?.status === 403 || error.response?.data?.error_code === 'UNLINKED_PASTOR')
  // A platform admin has no pastor row, so this page can never be used by them;
  // give the review screen as the way forward instead of a bare dead end (plan 023).
  const permission = useAccessPermission()
  const canReviewVoices = permission.readAny('prayer_voice_profile').granted

  const latest = submissions[0] ?? null
  const draft = latest?.reviewState === 'DRAFT' ? latest : null
  const editing = !!draft || startNew || (!loading && !latest && !error)
  const canRevise = latest?.reviewState === 'REJECTED' || latest?.reviewState === 'APPROVED'
  const churchId =
    draft?.churchId ?? selectedChurchId ?? latest?.churchId ?? churches?.[0]?.id ?? ''
  const churchName =
    draft?.churchName ?? churches?.find((c) => c.id === churchId)?.name ?? latest?.churchName ?? ''
  // A new revision after approval replaces the current voice; after rejection it
  // keeps whatever the rejected one was replacing.
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
    <>
      <DashboardMainHeader title="My Voice" description="Submit your sample for admin approval." />

      {error && !unlinked && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          title="Your voice submissions could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15} className="flex flex-col gap-4">
          <Col>
            <Card loading={loading}>
              <div className="mb-4">
                <div className="text-lg font-semibold">{latest?.pastorName ?? 'Your voice'}</div>
                {editing && !draft && (churches?.length ?? 0) > 1 ? (
                  <Select
                    className="w-64 mt-1"
                    aria-label="Church"
                    value={churchId || undefined}
                    onChange={setSelectedChurchId}
                    options={churches?.map((c) => ({ label: c.name, value: c.id }))}
                  />
                ) : (
                  <div className="text-gray-500">{churchName} · Your linked profile</div>
                )}
              </div>

              {editing && churchId ? (
                <>
                  {startNew && latest?.reviewState === 'APPROVED' && (
                    <Alert
                      className="mb-4"
                      type="info"
                      showIcon
                      title="Your current voice stays active until the new one is approved and ready."
                    />
                  )}
                  <DraftForm
                    key={draft ? `${draft.id}:${draft.version}` : `new:${churchId}`}
                    draft={draft}
                    churchId={churchId}
                    replacesProfileId={draft ? undefined : replacesProfileId}
                    onCancel={startNew && !draft ? () => setStartNew(false) : undefined}
                  />
                </>
              ) : editing && !churchesLoading ? (
                <Alert
                  type="warning"
                  showIcon
                  title="You are not assigned as a pastor of any church yet"
                  description="Ask a central administrator to assign your pastor profile to a church before submitting a voice."
                />
              ) : latest ? (
                <>
                  <ReadOnlyRevision profile={latest} />
                  {canRevise && (
                    <Button className="mt-4" onClick={() => setStartNew(true)}>
                      Start new revision
                    </Button>
                  )}
                </>
              ) : null}
            </Card>
          </Col>
          {submissions.length > 1 && (
            <Col className="mt-4">
              <Collapse
                defaultActiveKey={['history']}
                items={[
                  {
                    key: 'history',
                    label: `Earlier revisions (${submissions.length - 1})`,
                    children: (
                      <div className="space-y-2">
                        {submissions.slice(1).map((p) => (
                          <div key={p.id} className="flex flex-wrap items-center gap-2">
                            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                            <ReviewStateTag state={p.reviewState} />
                            <RegistrationStateTag state={p.registrationState} />
                            {p.reviewReason && (
                              <span className="text-gray-500">{p.reviewReason}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </Col>
          )}
        </Col>
        <Col xs={24} lg={9}>
          <StatusCard profile={latest} />
        </Col>
      </Row>
    </>
  )
}
