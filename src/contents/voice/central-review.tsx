'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useMediaAccess } from '@/hooks/data/media-access'
import {
  CentralVoiceListOptions,
  useApproveVoiceProfile,
  useCentralVoiceProfile,
  useCentralVoiceProfiles,
  useDisableVoiceProfile,
  useRejectVoiceProfile,
  useRevokeVoiceConsent,
} from '@/hooks/data/voice'
import { VoiceProfileDetail, VoiceProfileListItem } from '@/models/voice'
import { CloseOutlined } from '@ant-design/icons'
import { Alert, App, Button, Card, Col, Input, Row, Select, Table } from 'antd'
import { ColumnsType } from 'antd/es/table'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import RecordingTips from './recording-tips'
import SamplePlayer, { formatDuration } from './sample-player'
import {
  RegistrationStateTag,
  ReviewStateTag,
  registrationHelp,
  registrationLabel,
  reviewLabel,
} from './status'

/*
 * S24 Voice Submission Review (F4VO VO-05). Admin previews the exact submitted
 * revision and approves ("Approve and register") or rejects with a reason.
 * Registration state is read-only; the Voice ID is never entered manually.
 */

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

const columns: ColumnsType<VoiceProfileListItem> = [
  {
    key: 'pastor',
    title: 'Pastor / Church',
    render: (_, p) => (
      <div>
        <div className="font-medium">{p.pastorName}</div>
        <div className="text-gray-500">{p.churchName}</div>
      </div>
    ),
  },
  { key: 'submitted', title: 'Submitted', render: (_, p) => formatDate(p.submittedAt) },
  { key: 'samples', title: 'Samples', render: (_, p) => p.samples.length },
  { key: 'review', title: 'Admin review', render: (_, p) => reviewLabel(p.reviewState) },
  {
    key: 'registration',
    title: 'Registration',
    render: (_, p) => registrationLabel(p.registrationState),
  },
]

function EvidenceLink({ churchId, assetId }: { churchId: string; assetId: string | null }) {
  const { data, loading } = useMediaAccess(churchId, assetId)
  if (!assetId) return <span className="text-gray-500">No evidence file attached</span>
  return (
    <Button href={data?.url} target="_blank" rel="noreferrer" loading={loading} disabled={!data}>
      View signed evidence
    </Button>
  )
}

function ReviewPanel({ profile, onClose }: { profile: VoiceProfileDetail; onClose: () => void }) {
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
  const busy = approving || rejecting || disabling || revoking

  const pending = profile.reviewState === 'SUBMITTED'
  const canStop = profile.reviewState === 'APPROVED' && profile.registrationState !== 'DISABLED'
  const totalSeconds = profile.samples.reduce((sum, s) => sum + (durations[s.assetId] ?? 0), 0)
  const who = `${profile.pastorName} (${profile.churchName})`
  const ref = { id: profile.id, version: profile.version }

  const confirm = (title: string, content: string, okText: string, run: () => Promise<unknown>) =>
    modal.confirm({ title, content, okText, onOk: run })

  return (
    <Card
      title={`Review ${profile.pastorName}`}
      extra={<Button type="text" icon={<CloseOutlined />} aria-label="Close" onClick={onClose} />}
    >
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
              message={`Consent revoked ${formatDate(profile.consentRevokedAt)}`}
            />
          )}
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <ReviewStateTag state={profile.reviewState} />
            <RegistrationStateTag state={profile.registrationState} />
          </div>
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
          {profile.reviewReason && (
            <div className="text-gray-500">Review reason: {profile.reviewReason}</div>
          )}
        </section>

        {canUpdate && pending && isSelf && (
          <Alert type="info" showIcon message="You cannot review your own submission." />
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
    </Card>
  )
}

export default function ContentsVoiceReview() {
  const [reviewState, setReviewState] = useState<CentralVoiceListOptions['reviewState']>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, total, loading } = useCentralVoiceProfiles({
    reviewState,
    page,
    limit: pageSize,
  })
  const { data: detail, loading: detailLoading } = useCentralVoiceProfile(selectedId)

  return (
    <>
      <DashboardMainHeader
        title="Voice submissions"
        description="Review pastor samples before automatic registration."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={selectedId ? 13 : 24}>
          <Select
            allowClear
            className="w-full md:w-56 mb-2"
            placeholder="Filter admin review"
            aria-label="Filter admin review"
            value={reviewState}
            onChange={(value) => {
              setReviewState(value)
              setPage(1)
            }}
            options={(['SUBMITTED', 'APPROVED', 'REJECTED', 'DRAFT'] as const).map((s) => ({
              label: reviewLabel(s),
              value: s,
            }))}
          />
          <Table
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 'max-content' }}
            rowClassName={(p) =>
              p.id === selectedId ? 'bg-gray-100 cursor-pointer' : 'cursor-pointer'
            }
            onRow={(p) => ({ onClick: () => setSelectedId(p.id) })}
            onChange={(pagination) => {
              if (pagination.current) setPage(pagination.current)
              if (pagination.pageSize) setPageSize(pagination.pageSize)
            }}
            pagination={{ total, current: page, pageSize }}
          />

          <Row gutter={[16, 16]} className="mt-4">
            <Col xs={24} md={12}>
              <Card size="small" title="PRAYER ElevenLabs account">
                One platform account for all pastor voices. Only admin-approved submissions are sent
                to the provider.
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" title="Two separate checks">
                Admin approval permits registration. Provider readiness permits audio generation.
              </Card>
            </Col>
          </Row>
        </Col>

        {selectedId && (
          <Col xs={24} xl={11}>
            {detail ? (
              <ReviewPanel
                key={`${detail.id}:${detail.version}`}
                profile={detail}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <Card loading={detailLoading} />
            )}
          </Col>
        )}
      </Row>
    </>
  )
}
