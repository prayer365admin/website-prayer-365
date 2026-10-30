'use client'

import AudioWavePlayer from '@/components/common/audio-wave-player'
import SiteButton from '@/components/common/button'
import RichTextEditor from '@/components/common/rich-text-editor'
import RichTextContent from '@/components/common/rich-text-content'
import UploadBox from '@/components/common/upload-box'
import SelectPastor from '@/components/common/select/pastor'
import { AlignLeftIcon } from '@/components/icon/align-left'
import { PlayIcon } from '@/components/icon/play'
import { useChurchProfile } from '@/hooks/data/church'
import { useChurchPastors } from '@/hooks/data/pastor'
import {
  useApproveAudio,
  useApproveText,
  useCreatePrayer,
  useEnqueueAudio,
  usePatchPrayer,
  usePrayer,
  usePrayerAudio,
  usePublishPrayer,
  useSchedulePrayer,
} from '@/hooks/data/prayer'
import { useMediaAccess } from '@/hooks/data/media-access'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useRecloneVoiceProfile } from '@/hooks/data/voice'
import { PrayerInput, PrayerOutput } from '@/models/prayer'
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Spin,
  Tabs,
  TimePicker,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { utcToLocal } from '@/utils/utc-to-local'
import { useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { plainTextToRichText } from '@/utils/rich-text-plain'
import styles from './editor.module.scss'

dayjs.extend(utc)
dayjs.extend(timezone)

export default function ContentsChurchesPrayersEditor({
  churchId,
  prayerId,
  churchContext,
  createdPrayerPath,
  formDisabled = false,
}: {
  churchId: string
  prayerId?: string
  churchContext?: ReactNode
  createdPrayerPath?: (prayerId: string) => string
  formDisabled?: boolean
}) {
  const router = useRouter()
  const isEdit = !!prayerId
  const [form] = Form.useForm<PrayerInput>()

  const { data: prayer } = usePrayer(churchId, prayerId ?? '')
  const [saved, setSaved] = useState<PrayerOutput | null>(null)
  const [featuredAsset, setFeaturedAsset] = useState<{
    assetId: string | null
    url: string | null
  }>({ assetId: null, url: null })

  useEffect(() => {
    if (!prayer) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved((prev) => (!prev || prayer.version > prev.version ? prayer : prev))
    setFeaturedAsset((current) =>
      current.assetId === prayer.featuredAssetId
        ? current
        : {
            assetId: prayer.featuredAssetId ?? null,
            url: prayer.featuredAssetId
              ? `/api/v1/uploads/${prayer.featuredAssetId}/access?churchId=${encodeURIComponent(churchId)}`
              : null,
          },
    )
  }, [churchId, prayer])

  const { data: profile } = useChurchProfile(churchId)
  const { data: pastors } = useChurchPastors(churchId)

  const { onCreate, loading: createLoading } = useCreatePrayer(churchId)
  const { onPatch, loading: patchLoading } = usePatchPrayer(churchId, prayerId ?? '')
  const { onApproveText, loading: approveLoading } = useApproveText(churchId, prayerId ?? '')

  const [pendingAudioId, setPendingAudioId] = useState<string | null>(null)
  // Audio to show: the one generated in this session, else the newest for this text
  // version (picks up a generation still running in the worker after a reload),
  // else the approved one.
  const audioId = pendingAudioId ?? saved?.current?.latestAudioId ?? saved?.current?.selectedAudioId
  const { data: audio } = usePrayerAudio(churchId, prayerId ?? '', audioId ?? undefined)
  const { data: access } = useMediaAccess(churchId, audio?.assetId ?? null)
  const { onEnqueueAudio, loading: enqueueLoading } = useEnqueueAudio(churchId, prayerId ?? '')
  const { onApproveAudio, loading: approveAudioLoading } = useApproveAudio(
    churchId,
    prayerId ?? '',
    audioId ?? '',
  )
  const { onReclone, loading: recloneLoading } = useRecloneVoiceProfile()
  const [recloneStarted, setRecloneStarted] = useState(false)
  // Server enforces church scope; this only hides the button from roles without the grant.
  const canReclone = useAccessPermission().createAny('prayer_voice_generation').granted
  const { onSchedule, loading: scheduleLoading } = useSchedulePrayer(churchId, prayerId ?? '')
  const { onPublish, loading: publishLoading } = usePublishPrayer(churchId, prayerId ?? '')

  const currentPastor = pastors?.find((p) => p.id === saved?.current?.pastorId)
  const voiceProfileId = currentPastor?.activeVoiceProfileId ?? null
  const voiceReady = currentPastor?.voiceReady ?? false
  const audioInFlight = audio?.status === 'QUEUED' || audio?.status === 'GENERATING'
  const canGenerate = !!saved?.current && saved.textApproved && voiceReady && !audioInFlight
  // The due-scan never re-publishes a version that is already live, so scheduling it
  // again would lie about the state. Publishing a new text version is the way forward.
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
  const tzValid = !!profile?.timezone

  const [pubDate, setPubDate] = useState<Dayjs | null>(null)
  const [pubTime, setPubTime] = useState<Dayjs | null>(null)
  const scheduledIso =
    pubDate && pubTime && tzValid && profile?.timezone
      ? dayjs
          .tz(
            `${pubDate.format('YYYY-MM-DD')} ${pubTime.format('HH:mm')}`,
            'YYYY-MM-DD HH:mm',
            profile.timezone,
          )
          .toISOString()
      : null

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

  const [reviewOpen, setReviewOpen] = useState(false)
  const saveLoading = createLoading || patchLoading

  const handleSubmit = async (payload: PrayerInput) => {
    if (!churchId) return
    const input = { ...payload, featuredAssetId: featuredAsset.assetId }
    if (isEdit && saved) {
      const result = await onPatch({ ...input, version: saved.version })
      setSaved(result)
    } else {
      const result = await onCreate(input)
      router.replace(
        createdPrayerPath?.(result.id) ?? `/dashboard/churches/${churchId}/prayers/${result.id}`,
      )
    }
  }

  const handleApprove = async () => {
    if (!saved || !saved.current) return
    const result = await onApproveText({
      version: saved.version,
      prayerVersionId: saved.current.id,
    })
    setSaved((prev) => (prev ? { ...prev, textApproved: true, current: result } : null))
    setReviewOpen(false)
  }

  if (isEdit && !saved) {
    return (
      <section className={styles.page}>
        <header className={styles.editorHeader}>
          <button
            aria-label="Back to prayers"
            className={styles.backButton}
            onClick={() => router.back()}
            type="button"
          >
            <ArrowLeftOutlined />
          </button>
          <div>
            <div className={styles.titleLabel}>
              Prayer title <span>*</span>
            </div>
            <div className={styles.titleSkeleton} />
          </div>
        </header>
        <div
          aria-busy="true"
          aria-label="Loading prayer editor"
          className={styles.editorSkeleton}
          role="status"
        >
          <div className={styles.tabsSkeleton}>
            <div className={`${styles.skeletonShape} ${styles.activeTabSkeleton}`} />
            <div className={`${styles.skeletonShape} ${styles.tabSkeleton}`} />
          </div>
          <div className={styles.formSkeleton}>
            <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
            <div className={`${styles.skeletonField} ${styles.imageFieldSkeleton}`} />
            <div className={`${styles.skeletonField} ${styles.editorFieldSkeleton}`} />
            <div className={styles.skeletonFieldGrid}>
              <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
              <div className={`${styles.skeletonField} ${styles.inputFieldSkeleton}`} />
            </div>
            <div className={`${styles.skeletonField} ${styles.bodyFieldSkeleton}`} />
            <div className={styles.skeletonActions}>
              <div className={`${styles.skeletonShape} ${styles.buttonSkeleton}`} />
              <div className={`${styles.skeletonShape} ${styles.buttonSkeleton}`} />
            </div>
          </div>
        </div>
      </section>
    )
  }

  const formJSX = (
    <Form
      className={styles.textForm}
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={
        saved?.current
          ? {
              title: saved.current.title,
              introduction: saved.current.introduction,
              pastorId: saved.current.pastorId,
              languageCode: saved.current.languageCode,
              body: saved.current.body,
            }
          : undefined
      }
    >
      {churchContext}
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, message: 'Title is required.' }]}
      >
        <Input disabled={formDisabled} size="large" />
      </Form.Item>
      <Form.Item label="Featured image">
        <UploadBox
          formName="featuredAssetId"
          churchId={churchId}
          purpose="IMAGE"
          disabled={formDisabled}
          upload={featuredAsset}
          setUpload={(value) => {
            const next = value as { url: string | null; assetId?: string | null }
            setFeaturedAsset({
              assetId: next.assetId ?? null,
              url: next.url,
            })
            form.setFieldValue('featuredAssetId', next.assetId ?? null)
          }}
          width="320px"
          height="180px"
        />
      </Form.Item>
      <Form.Item name="introduction" label="Introduction">
        <RichTextEditor
          ariaLabel="Introduction"
          disabled={formDisabled}
          minHeight={120}
          placeholder="Write a short introduction to the prayer"
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <SelectPastor
            name="pastorId"
            label="Pastor"
            churchId={churchId}
            className="prayer-form-select"
            disabled={formDisabled}
            size="large"
          />
        </Col>
        <Col span={12}>
          <Form.Item
            name="languageCode"
            label="Content language"
            rules={[{ required: true, message: 'Content language is required.' }]}
          >
            <Select
              className="prayer-form-select"
              disabled={formDisabled}
              options={(profile?.languageCodes ?? []).map((code) => ({ value: code, label: code }))}
              size="large"
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="body"
        label="Full prayer text"
        rules={[{ required: true, message: 'Full prayer text is required.' }]}
      >
        <RichTextEditor
          ariaLabel="Full prayer text"
          disabled={formDisabled}
          minHeight={280}
          placeholder="Write the full prayer text"
        />
      </Form.Item>
      <div className={styles.textActions}>
        <Upload
          accept=".txt"
          disabled={formDisabled}
          showUploadList={false}
          beforeUpload={async (file) => {
            const text = await file.text()
            form.setFieldsValue({ body: plainTextToRichText(text.replace(/\r\n?/g, '\n')) })
            await form.validateFields(['body']).catch(() => undefined)
            return Upload.LIST_IGNORE
          }}
        >
          <SiteButton
            disabled={formDisabled}
            icon={<UploadOutlined aria-hidden className={styles.editorIcon} />}
            iconPlacement="end"
            size="md"
            variant="outlined"
          >
            Upload text
          </SiteButton>
        </Upload>
        <div className={styles.textActionButtons}>
          <SiteButton
            disabled={formDisabled}
            icon={<CheckOutlined aria-hidden className={styles.editorIcon} />}
            iconPlacement="end"
            loading={saveLoading}
            size="md"
            type="submit"
          >
            Save text
          </SiteButton>
        </div>
      </div>
    </Form>
  )

  const reviewModalJSX = (
    <Drawer
      closable={{ placement: 'end' }}
      rootClassName={styles.reviewDrawer}
      title="Review text for audio"
      open={reviewOpen}
      onClose={() => setReviewOpen(false)}
      size={640}
      footer={
        <div className={styles.drawerFooter}>
          <SiteButton size="md" variant="outlined" onClick={() => setReviewOpen(false)}>
            Cancel
          </SiteButton>
          {saved?.current && !saved.textApproved && (
            <SiteButton
              icon={<CheckOutlined aria-hidden className={styles.editorIcon} />}
              iconPlacement="end"
              loading={approveLoading}
              size="md"
              onClick={handleApprove}
            >
              Approve text for audio
            </SiteButton>
          )}
        </div>
      }
    >
      {saved?.current && (
        <div className={styles.reviewContent}>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Title</div>
            <div className={styles.reviewFieldValue}>{saved.current.title}</div>
          </div>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Introduction</div>
            <div className={styles.reviewFieldValue}>
              {saved.current.introduction ? (
                <RichTextContent html={saved.current.introduction} />
              ) : (
                '—'
              )}
            </div>
          </div>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Full prayer text</div>
            <div className={styles.reviewFieldValue}>
              <RichTextContent html={saved.current.body} />
            </div>
          </div>
          <Row gutter={16}>
            <Col className={styles.reviewField} span={12}>
              <div className={styles.reviewFieldTitle}>Pastor</div>
              <div className={styles.reviewFieldValue}>
                {pastors?.find((p) => p.id === saved.current?.pastorId)?.name ||
                  saved.current.pastorId}
              </div>
            </Col>
            <Col className={styles.reviewField} span={12}>
              <div className={styles.reviewFieldTitle}>Content language</div>
              <div className={styles.reviewFieldValue}>{saved.current.languageCode}</div>
            </Col>
          </Row>
          <div className={styles.reviewField}>
            <div className={styles.reviewFieldTitle}>Version</div>
            <div className={styles.reviewFieldValue}>{saved.current.versionNumber}</div>
          </div>

          {saved.textApproved && (
            <div className={styles.reviewApprovalBanner} role="status">
              <CheckCircleOutlined aria-hidden />
              <span>
                Text approved
                {saved.current.approvedByName ? ` by ${saved.current.approvedByName}` : ''}
              </span>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )

  // One inner card per step (generate → review → publish) so each flow reads on its own.
  const audioJSX = (
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
                onClick={() => setReviewOpen(true)}
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
              value={pubDate}
              onChange={setPubDate}
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
              value={pubTime}
              onChange={setPubTime}
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

  const tabItems = [
    {
      key: 'text',
      label: 'Text',
      children: formJSX,
    },
    {
      key: 'audio',
      label: 'Audio & Publication',
      children: audioJSX,
    },
  ]

  return (
    <section className={styles.page}>
      <header className={styles.editorHeader}>
        <button
          aria-label="Back to prayers"
          className={styles.backButton}
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeftOutlined />
        </button>
        <div>
          <div className={styles.titleLabel}>
            Prayer title <span>*</span>
          </div>
          <h1>{saved?.current?.title ?? 'New Prayer'}</h1>
        </div>
      </header>
      <Tabs className={styles.editorTabs} items={tabItems} />
      {reviewModalJSX}
    </section>
  )
}
