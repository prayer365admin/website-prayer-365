'use client'

import AudioWavePlayer from '@/components/common/audio-wave-player'
import SiteButton from '@/components/common/button'
import { AlignLeftIcon } from '@/components/icon/align-left'
import { PlayIcon } from '@/components/icon/play'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useMediaAccess } from '@/hooks/data/media-access'
import {
  useApproveAudio,
  useEnqueueAudio,
  usePrayerAudio,
  usePublishPrayer,
  useSchedulePrayer,
} from '@/hooks/data/prayer'
import { useRecloneVoiceProfile } from '@/hooks/data/voice'
import { ChurchProfileOutput } from '@/models/church'
import { ChurchPastorSummary } from '@/models/pastor'
import { PrayerOutput } from '@/models/prayer'
import { utcToLocal } from '@/utils/utc-to-local'
import { CalendarOutlined, CheckOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { Alert, Card, Col, DatePicker, Input, Row, Spin, TimePicker } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { useState } from 'react'
import styles from '../editor.module.scss'

dayjs.extend(utc)
dayjs.extend(timezone)

export default function PrayerAudioPublicationTab({
  churchId,
  onOpenReview,
  pastors,
  prayerId,
  profile,
  saved,
}: {
  churchId: string
  onOpenReview: () => void
  pastors?: ChurchPastorSummary[]
  prayerId: string
  profile?: ChurchProfileOutput
  saved: PrayerOutput | null
}) {
  const [pendingAudioId, setPendingAudioId] = useState<string | null>(null)
  const [recloneStarted, setRecloneStarted] = useState(false)
  const [publicationDate, setPublicationDate] = useState<Dayjs | null>(null)
  const [publicationTime, setPublicationTime] = useState<Dayjs | null>(null)

  // Prefer audio generated in this session, then the newest audio for this text
  // version, then the approved audio.
  const audioId = pendingAudioId ?? saved?.current?.latestAudioId ?? saved?.current?.selectedAudioId
  const { data: audio } = usePrayerAudio(churchId, prayerId, audioId ?? undefined)
  const { data: access } = useMediaAccess(churchId, audio?.assetId ?? null)
  const { onEnqueueAudio, loading: enqueueLoading } = useEnqueueAudio(churchId, prayerId)
  const { onApproveAudio, loading: approveAudioLoading } = useApproveAudio(
    churchId,
    prayerId,
    audioId ?? '',
  )
  const { onReclone, loading: recloneLoading } = useRecloneVoiceProfile()
  const { onSchedule, loading: scheduleLoading } = useSchedulePrayer(churchId, prayerId)
  const { onPublish, loading: publishLoading } = usePublishPrayer(churchId, prayerId)

  // Server authorization is authoritative; this only controls button visibility.
  const canReclone = useAccessPermission().createAny('prayer_voice_generation').granted
  const currentPastor = pastors?.find((pastor) => pastor.id === saved?.current?.pastorId)
  const voiceProfileId = currentPastor?.activeVoiceProfileId ?? null
  const voiceReady = currentPastor?.voiceReady ?? false
  const audioInFlight = audio?.status === 'QUEUED' || audio?.status === 'GENERATING'
  const canGenerate = !!saved?.current && saved.textApproved && voiceReady && !audioInFlight
  const currentAlreadyPublished =
    !!saved?.current && saved.published?.prayerVersionId === saved.current.id
  const generateDisabledReason = !saved
    ? 'Save the text first.'
    : !saved.textApproved
      ? 'Approve the reviewed text first.'
      : !voiceReady
        ? 'The pastor has no verified voice for this church.'
        : audioInFlight
          ? 'Audio is already being generated for this text.'
          : ''
  const canApproveAudio =
    !!saved?.current &&
    saved.textApproved &&
    !!audio &&
    audio.status === 'READY' &&
    !audio.approvedAt
  const scheduledIso =
    publicationDate && publicationTime && profile?.timezone
      ? dayjs
          .tz(
            `${publicationDate.format('YYYY-MM-DD')} ${publicationTime.format('HH:mm')}`,
            'YYYY-MM-DD HH:mm',
            profile.timezone,
          )
          .toISOString()
      : null

  const stateLabel = saved?.published
    ? 'Published'
    : saved?.scheduled
      ? 'Scheduled'
      : audio?.status === 'APPROVED'
        ? 'Audio approved'
        : audio?.status === 'READY'
          ? 'Ready for review'
          : audio?.status === 'QUEUED' || audio?.status === 'GENERATING'
            ? 'Generating audio'
            : audio?.status === 'FAILED'
              ? 'Generation failed'
              : 'Not started'

  const handleGenerate = async () => {
    if (!saved?.current || !voiceProfileId) return
    const result = await onEnqueueAudio({
      version: saved.version,
      prayerVersionId: saved.current.id,
      voiceProfileId,
    })
    setPendingAudioId(result.id)
  }

  const handleApproveAudio = async () => {
    if (!saved?.current || !audioId) return
    await onApproveAudio({ version: saved.version, prayerVersionId: saved.current.id })
  }

  const handleSchedule = async () => {
    if (!saved?.current || !scheduledIso) return
    await onSchedule({
      version: saved.version,
      prayerVersionId: saved.current.id,
      scheduledAt: scheduledIso,
    })
  }

  const handlePublish = async () => {
    if (!saved?.current) return
    await onPublish({ version: saved.version, prayerVersionId: saved.current.id })
  }

  return (
    <div className={styles.audioPanel}>
      <Card className={styles.audioGenerationCard} type="inner" title="Audio generation">
        <div className={styles.generationGrid}>
          <section className={styles.generationStep}>
            <div className={styles.generationStepHeader}>
              <span>Review text</span>
              <span
                className={`${styles.statePill} ${saved?.textApproved ? styles.statePositive : styles.stateAlert}`}
              >
                <span aria-hidden="true" />
                {saved?.textApproved ? 'Approved' : 'Not approved'}
              </span>
            </div>
            <div className={styles.generationStepBody}>
              <SiteButton
                icon={<AlignLeftIcon aria-hidden className={styles.editorIcon} />}
                iconPlacement="end"
                onClick={onOpenReview}
                size="md"
                variant="outlined"
              >
                View reviewed text
              </SiteButton>
            </div>
          </section>
          <section className={styles.generationStep}>
            <div className={styles.generationStepHeader}>
              <span>Pastor voice</span>
              <span
                className={`${styles.statePill} ${voiceReady ? styles.statePositive : styles.stateAlert}`}
              >
                <span aria-hidden="true" />
                {voiceReady ? 'Verified' : 'Not ready'}
              </span>
            </div>
            <div className={styles.generationStepBody}>
              <SiteButton
                disabled={!canGenerate}
                icon={<PlayIcon aria-hidden className={styles.editorIcon} />}
                iconPlacement="end"
                loading={enqueueLoading}
                onClick={handleGenerate}
                size="md"
              >
                Generate audio
              </SiteButton>
              {!canGenerate && <div className={styles.stepHelp}>{generateDisabledReason}</div>}
            </div>
          </section>
        </div>
      </Card>

      <Card className={styles.audioReviewCard} type="inner" title="Audio Review">
        {!audioId ? (
          <div>No audio generated yet.</div>
        ) : audio?.status === 'QUEUED' || audio?.status === 'GENERATING' ? (
          <div>
            <Spin /> Generating audio…
          </div>
        ) : audio?.status === 'FAILED' && audio.errorCode === 'VOICE_MISSING_AT_PROVIDER' ? (
          <Alert
            type="warning"
            showIcon
            title="The pastor's voice no longer exists at the provider."
            description={
              recloneStarted ? (
                'The voice is being re-created. Generate audio again once the pastor voice is ready.'
              ) : canReclone ? (
                <SiteButton
                  className="mt-2"
                  loading={recloneLoading}
                  onClick={async () => {
                    await onReclone({ churchId, id: audio.voiceProfileId })
                    setRecloneStarted(true)
                  }}
                  size="md"
                  variant="outlined"
                >
                  Re-create voice
                </SiteButton>
              ) : (
                'Ask an admin to re-create the voice.'
              )
            }
          />
        ) : audio?.status === 'FAILED' ? (
          <div>
            Audio generation failed{audio.errorCode ? ` (${audio.errorCode})` : ''}.
            <SiteButton
              icon={<PlayIcon aria-hidden className={styles.editorIcon} />}
              iconPlacement="end"
              onClick={handleGenerate}
              size="md"
              variant="outlined"
            >
              Generate again
            </SiteButton>
          </div>
        ) : (
          <div className={styles.generatedAudio}>
            {!access?.url ? (
              <Spin />
            ) : (
              <AudioWavePlayer
                label="Generated prayer audio"
                seed={audioId ?? 'generated-prayer-audio'}
                src={access.url}
              />
            )}
          </div>
        )}

        <div className="mt-4">State: {stateLabel}</div>
        {audio?.approvedAt ? (
          <div className="text-gray-500">Audio approved.</div>
        ) : (
          <SiteButton
            disabled={!canApproveAudio}
            icon={<PlayIcon aria-hidden className={styles.editorIcon} />}
            iconPlacement="end"
            loading={approveAudioLoading}
            onClick={handleApproveAudio}
            size="md"
          >
            Approve audio
          </SiteButton>
        )}
      </Card>

      <Card className={styles.publicationCard} type="inner" title="Publication">
        <Row gutter={16}>
          <Col span={8}>
            <div>Publication date</div>
            <DatePicker
              prefix={<CalendarOutlined aria-hidden className={styles.editorIcon} />}
              placeholder="Publication date"
              size="large"
              suffixIcon={null}
              value={publicationDate}
              onChange={setPublicationDate}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={8}>
            <div>Time</div>
            <TimePicker
              prefix={<ClockCircleOutlined aria-hidden className={styles.editorIcon} />}
              placeholder="Select time"
              format="HH:mm"
              size="large"
              suffixIcon={null}
              value={publicationTime}
              onChange={setPublicationTime}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={8}>
            <div>Time zone</div>
            <Input value={profile?.timezone ?? ''} disabled size="large" />
          </Col>
        </Row>
        {saved?.scheduled ? (
          <div className="mt-2">
            Scheduled for{' '}
            {utcToLocal(
              saved.scheduled.scheduledAt,
              'DD MMM YYYY HH:mm',
              profile?.timezone ?? undefined,
            )}
          </div>
        ) : saved?.published ? (
          <div className="mt-2">
            Published{' '}
            {utcToLocal(
              saved.published.publishedAt,
              'DD MMM YYYY HH:mm',
              profile?.timezone ?? undefined,
            )}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 mt-4">
          <SiteButton
            disabled={
              !scheduledIso || !saved?.current || !saved?.textApproved || currentAlreadyPublished
            }
            icon={<CalendarOutlined aria-hidden className={styles.editorIcon} />}
            iconPlacement="end"
            loading={scheduleLoading}
            onClick={handleSchedule}
            size="md"
          >
            Schedule publication
          </SiteButton>
          <SiteButton
            disabled={!saved?.current || !saved?.textApproved}
            icon={<CheckOutlined aria-hidden className={styles.editorIcon} />}
            iconPlacement="end"
            loading={publishLoading}
            onClick={handlePublish}
            size="md"
          >
            Publish now
          </SiteButton>
        </div>
        {currentAlreadyPublished && (
          <div className="text-gray-500">
            This version is already published. Edit the text to publish a new version.
          </div>
        )}
      </Card>
    </div>
  )
}
