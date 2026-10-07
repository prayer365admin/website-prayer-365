'use client'

import CardTitle from '@/components/common/card-title'
import SelectPastor from '@/components/common/select/pastor'
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
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Spin,
  Tabs,
  TimePicker,
  Upload,
} from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { utcToLocal } from '@/utils/utc-to-local'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

dayjs.extend(utc)
dayjs.extend(timezone)

export default function ContentsChurchesPrayersEditor({
  churchId,
  prayerId,
}: {
  churchId: string
  prayerId?: string
}) {
  const router = useRouter()
  const isEdit = !!prayerId
  const [form] = Form.useForm<PrayerInput>()

  const { data: prayer } = usePrayer(churchId, prayerId ?? '')
  const [saved, setSaved] = useState<PrayerOutput | null>(null)

  useEffect(() => {
    if (!prayer) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved((prev) => (!prev || prayer.version > prev.version ? prayer : prev))
  }, [prayer])

  const { data: profile } = useChurchProfile(churchId)
  const { data: pastors } = useChurchPastors(churchId)

  const { onCreate, loading: createLoading } = useCreatePrayer(churchId)
  const { onPatch, loading: patchLoading } = usePatchPrayer(churchId, prayerId ?? '')
  const { onApproveText, loading: approveLoading } = useApproveText(churchId, prayerId ?? '')

  const [pendingAudioId, setPendingAudioId] = useState<string | null>(null)
  const audioId = pendingAudioId ?? saved?.current?.selectedAudioId
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
  const canGenerate = !!saved?.current && saved.textApproved && voiceReady
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
    if (isEdit && saved) {
      const result = await onPatch({ ...payload, version: saved.version })
      setSaved(result)
    } else {
      const result = await onCreate(payload)
      router.replace(`/dashboard/churches/${churchId}/prayers/${result.id}`)
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
      <Card title={<CardTitle title="Prayer Editor" />}>
        <Skeleton active />
      </Card>
    )
  }

  const formJSX = (
    <Form
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
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, message: 'Title is required.' }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="introduction" label="Introduction">
        <Input />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <SelectPastor name="pastorId" label="Pastor" churchId={churchId} />
        </Col>
        <Col span={12}>
          <Form.Item
            name="languageCode"
            label="Content language"
            rules={[{ required: true, message: 'Content language is required.' }]}
          >
            <Select
              options={(profile?.languageCodes ?? []).map((code) => ({ value: code, label: code }))}
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="body"
        label="Full prayer text"
        rules={[{ required: true, message: 'Full prayer text is required.' }]}
      >
        <Input.TextArea rows={8} />
      </Form.Item>
      <div className="flex justify-between items-center">
        <Upload
          accept=".txt"
          showUploadList={false}
          beforeUpload={() => false}
          onChange={async (info) => {
            if (info.file.originFileObj) {
              const text = await info.file.originFileObj.text()
              form.setFieldsValue({ body: text })
            }
          }}
        >
          <Button>Upload text</Button>
        </Upload>
        <div className="flex gap-2">
          <Button type="primary" htmlType="submit" loading={saveLoading}>
            Save text
          </Button>
          <Button disabled={!saved?.current} onClick={() => setReviewOpen(true)}>
            Review text for audio
          </Button>
        </div>
      </div>
    </Form>
  )

  const reviewModalJSX = (
    <Modal
      title="Review text for audio"
      open={reviewOpen}
      onCancel={() => setReviewOpen(false)}
      footer={null}
    >
      {saved?.current && (
        <div className="space-y-4">
          <div>
            <div className="font-semibold text-gray-500">Title</div>
            <div>{saved.current.title}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-500">Introduction</div>
            <div>{saved.current.introduction || '—'}</div>
          </div>
          <div>
            <div className="font-semibold text-gray-500">Full prayer text</div>
            <div className="whitespace-pre-wrap">{saved.current.body}</div>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <div className="font-semibold text-gray-500">Pastor</div>
              <div>
                {pastors?.find((p) => p.id === saved.current?.pastorId)?.name ||
                  saved.current.pastorId}
              </div>
            </Col>
            <Col span={12}>
              <div className="font-semibold text-gray-500">Content language</div>
              <div>{saved.current.languageCode}</div>
            </Col>
          </Row>
          <div>
            <div className="font-semibold text-gray-500">Version</div>
            <div>{saved.current.versionNumber}</div>
          </div>

          <div className="flex justify-end mt-6">
            {saved.textApproved ? (
              <span className="text-gray-500">
                Text approved{saved.current.approvedBy ? ` by ${saved.current.approvedBy}` : ''}
              </span>
            ) : (
              <Button type="primary" loading={approveLoading} onClick={handleApprove}>
                Approve text for audio
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )

  const audioJSX = (
    <div className="space-y-6">
      <Row gutter={16}>
        <Col span={12}>
          <div>Reviewed text: {saved?.textApproved ? 'Ready' : 'Not approved'}</div>
          <Button onClick={() => setReviewOpen(true)}>View reviewed text</Button>
        </Col>
        <Col span={12}>
          <div>Pastor voice: {voiceReady ? 'Verified' : 'Not ready'}</div>
          <Button
            type="primary"
            loading={enqueueLoading}
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            Generate audio
          </Button>
          {!canGenerate && <div className="text-gray-500">{generateDisabledReason}</div>}
        </Col>
      </Row>

      <div className="border p-4 rounded">
        <h3 className="font-semibold mb-2">Audio preview</h3>
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
                <Button
                  className="mt-2"
                  loading={recloneLoading}
                  onClick={async () => {
                    await onReclone({ churchId, id: audio.voiceProfileId })
                    setRecloneStarted(true)
                  }}
                >
                  Re-create voice
                </Button>
              ) : (
                'Ask an admin to re-create the voice.'
              )
            }
          />
        ) : audio?.status === 'FAILED' ? (
          <div>
            Audio generation failed{audio.errorCode ? ` (${audio.errorCode})` : ''}.
            <Button onClick={handleGenerate}>Generate again</Button>
          </div>
        ) : (
          <div>{!access?.url ? <Spin /> : <audio controls src={access.url} />}</div>
        )}
      </div>

      <div>
        <div>State: {stateLabel}</div>
        {audio?.approvedAt ? (
          <div className="text-gray-500">Audio approved.</div>
        ) : (
          <Button
            type="primary"
            loading={approveAudioLoading}
            disabled={!canApproveAudio}
            onClick={handleApproveAudio}
          >
            Approve audio
          </Button>
        )}
      </div>

      <div>
        <Row gutter={16}>
          <Col span={8}>
            <div>Publication date</div>
            <DatePicker
              placeholder="Publication date"
              value={pubDate}
              onChange={setPubDate}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={8}>
            <div>Time</div>
            <TimePicker
              placeholder="Select time"
              format="HH:mm"
              value={pubTime}
              onChange={setPubTime}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={8}>
            <div>Time zone</div>
            <Input value={profile?.timezone ?? ''} disabled />
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
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="primary"
          loading={scheduleLoading}
          disabled={
            !scheduledIso || !saved?.current || !saved?.textApproved || currentAlreadyPublished
          }
          onClick={handleSchedule}
        >
          Schedule publication
        </Button>
        <Button
          type="primary"
          loading={publishLoading}
          disabled={!saved?.current || !saved?.textApproved}
          onClick={handlePublish}
        >
          Publish now
        </Button>
      </div>
      {currentAlreadyPublished && (
        <div className="text-gray-500">
          This version is already published. Edit the text to publish a new version.
        </div>
      )}
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
    <Card title={<CardTitle title="Prayer Editor" />}>
      <Tabs items={tabItems} />
      {reviewModalJSX}
    </Card>
  )
}
