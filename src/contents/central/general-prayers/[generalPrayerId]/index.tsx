'use client'

import AudioWavePlayer from '@/components/common/audio-wave-player'
import SiteButton from '@/components/common/button'
import RichTextContent from '@/components/common/rich-text-content'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useLanguages } from '@/hooks/data/central'
import {
  useEnqueueGeneralPrayerAudio,
  useGeneralPrayer,
  useGeneralPrayerAudioAccess,
  useUpdateGeneralPrayer,
} from '@/hooks/data/general-prayer'
import type { GeneralPrayerOutput, GeneralPrayerUpdate } from '@/models/general-prayer'
import { Alert, AlertProps, Form, Input, Select, Skeleton, Spin, Switch } from 'antd'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import GeneralPrayerBodyField from '../body-field'

type EditorValues = {
  title: string
  introduction?: string
  verse?: string
  verseReference?: string
  liturgicalNote?: string
  references?: string
  body: string
  languageCode: string
  isActive: boolean
}

const AUDIO_STATUS_LABEL: Record<string, string> = {
  QUEUED: 'Queued',
  GENERATING: 'Generating',
  READY: 'Ready',
  FAILED: 'Failed',
}

const AUDIO_STATUS_CLASS: Record<string, string> = {
  QUEUED: 'bg-[#edf4ff] border-[#dce9fb] text-[#1758a6]',
  GENERATING: 'bg-[#edf4ff] border-[#dce9fb] text-[#1758a6]',
  READY: 'bg-[#edfdf9] border-[#d3faef] text-[#09a97c]',
  FAILED: 'bg-[#fdf0ef] border-[#f8c9c9] text-[#d12920]',
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold leading-none w-fit shrink-0 ${
        AUDIO_STATUS_CLASS[status] ?? 'bg-[#f0f2f5] border-[#dde0e4] text-[#5c6370]'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {AUDIO_STATUS_LABEL[status] ?? status}
    </span>
  )
}

/** Values with an edit worth sending; null clears the field on the wire. */
const toUpdate = (values: EditorValues, current: GeneralPrayerOutput): GeneralPrayerUpdate => ({
  version: current.version,
  title: values.title,
  body: values.body,
  introduction: values.introduction?.trim() ? values.introduction.trim() : null,
  verse: values.verse?.trim() ? values.verse.trim() : null,
  verseReference: values.verseReference?.trim() ? values.verseReference.trim() : null,
  liturgicalNote: values.liturgicalNote?.trim() ? values.liturgicalNote.trim() : null,
  references: values.references?.trim() ? values.references.trim() : null,
  languageCode: values.languageCode,
  isActive: values.isActive,
})

const plainLength = (html: string | undefined) =>
  (html ?? '').replace(/<[^>]*>/g, ' ').trim().length

export default function ContentsCentralGeneralPrayerEditor({
  generalPrayerId,
}: {
  generalPrayerId: string
}) {
  const [form] = Form.useForm<EditorValues>()
  // Set when this screen enqueues audio, so a QUEUED row is polled only when a
  // job behind it is actually expected.
  const [awaitingAudio, setAwaitingAudio] = useState(false)
  const {
    data: prayer,
    loading,
    error,
  } = useGeneralPrayer(generalPrayerId, {
    pollQueued: awaitingAudio,
  })
  const { onUpdate, loading: saving } = useUpdateGeneralPrayer(generalPrayerId)
  const { onEnqueueAudio, loading: enqueueing } = useEnqueueGeneralPrayerAudio(generalPrayerId)
  const permission = useAccessPermission()
  const canUpdate =
    permission.updateAny('prayer_general_prayer').granted ||
    permission.updateOwn('prayer_general_prayer').granted

  // Only GENERATING blocks a new request (the API answers 409 in that state).
  // A QUEUED row is content nobody has generated yet: the button stays usable.
  const audioInFlight = prayer?.audioStatus === 'GENERATING'
  const bodyLength = useMemo(() => plainLength(prayer?.body), [prayer?.body])

  // The API accepts only ENABLED registry codes (`GET_AVAILABLE_LANGUAGE_CODES`),
  // so the options come from the language registry instead of a fixed list.
  const { data: languages } = useLanguages()
  const languageOptions = useMemo(() => {
    const enabled = (languages ?? []).filter((row) => row.enabled)
    const options = enabled.map((row) => ({
      value: row.code.trim(),
      label: `${row.code.trim()} — ${row.name}`,
    }))
    const current = prayer?.languageCode?.trim()
    if (current && !options.some((option) => option.value === current)) {
      options.unshift({ value: current, label: current })
    }
    return options
  }, [languages, prayer?.languageCode])

  // The admin player needs a short-lived URL: the DTO carries only audioAssetId.
  const { data: audioAccess, loading: audioAccessLoading } = useGeneralPrayerAudioAccess(
    prayer?.audioStatus === 'READY' ? prayer?.audioAssetId : null,
  )

  useEffect(() => {
    if (!prayer) return
    form.setFieldsValue({
      title: prayer.title,
      introduction: prayer.introduction ?? '',
      verse: prayer.verse ?? '',
      verseReference: prayer.verseReference ?? '',
      liturgicalNote: prayer.liturgicalNote ?? '',
      references: prayer.references ?? '',
      body: prayer.body,
      languageCode: prayer.languageCode,
      isActive: prayer.isActive,
    })
  }, [form, prayer])

  if (error) {
    return (
      <Alert
        showIcon
        type="warning"
        message="General prayer not found"
        description="This prayer is unavailable. It may have been removed from the cycle."
      />
    )
  }

  if (loading || !prayer) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-3xl">
        <Skeleton active paragraph={{ rows: 6 }} title={{ width: 240 }} />
      </div>
    )
  }

  const submit = async (values: EditorValues) => {
    await onUpdate(toUpdate(values, prayer))
  }

  const audioPanel: { alert?: AlertProps; body: ReactNode } = audioInFlight
    ? {
        body: (
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Spin size="small" /> Generating audio…
          </div>
        ),
      }
    : prayer.audioStatus === 'READY' && audioAccess?.url
      ? {
          body: (
            // Same control as the church prayer editor (protected voice samples and
            // generated audio) — the browser's native <audio> bar is not used anywhere
            // else in the dashboard.
            <AudioWavePlayer
              label={`Audio for ${prayer.title}`}
              seed={prayer.audioAssetId ?? prayer.slug}
              src={audioAccess.url}
            />
          ),
        }
      : prayer.audioStatus === 'READY'
        ? {
            body: (
              <div className="text-sm text-neutral-600">
                Audio ready
                {audioAccessLoading ? ' — loading player…' : ' — player unavailable right now.'}
              </div>
            ),
          }
        : prayer.audioStatus === 'FAILED'
          ? {
              alert: {
                type: 'error' as const,
                showIcon: true,
                message: 'Audio generation failed',
                description: prayer.audioErrorCode
                  ? `Provider error: ${prayer.audioErrorCode}. You can try again.`
                  : 'You can try again.',
              },
              body: null,
            }
          : {
              body: <div className="text-sm text-neutral-600">No audio generated yet.</div>,
            }

  const generateDisabled = !!audioInFlight || bodyLength === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[2px] text-neutral-500 m-0">
          {prayer.slug}
        </p>
        <h1 className="text-2xl font-semibold text-primary-900 m-0 leading-tight">
          Cycle position {prayer.sequence}
        </h1>
      </div>

      {/* Row on desktop so the editor uses the full page; tablet and below stack. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6">
          <Form<EditorValues>
            disabled={!canUpdate || saving}
            form={form}
            layout="vertical"
            onFinish={submit}
          >
            <div className="grid gap-x-4 md:grid-cols-2">
              <Form.Item<EditorValues>
                label="Title"
                name="title"
                rules={[{ required: true, message: 'Title is required.' }]}
              >
                <Input aria-label="Title" maxLength={500} />
              </Form.Item>
              <Form.Item<EditorValues>
                label="Content language"
                name="languageCode"
                rules={[{ required: true, message: 'Content language is required.' }]}
              >
                <Select
                  aria-label="Content language"
                  className="!w-40"
                  optionFilterProp="label"
                  options={languageOptions}
                  showSearch
                />
              </Form.Item>
              <Form.Item<EditorValues> label="Introduction" name="introduction">
                <Input.TextArea
                  aria-label="Introduction"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  maxLength={4000}
                  placeholder="Optional short introduction (plain text)"
                />
              </Form.Item>
              <Form.Item<EditorValues> label="Bible verse" name="verse">
                <Input.TextArea
                  aria-label="Bible verse"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  maxLength={4000}
                  placeholder="Optional verse text"
                />
              </Form.Item>
              <Form.Item<EditorValues> label="Verse reference" name="verseReference">
                <Input aria-label="Verse reference" maxLength={500} placeholder="e.g. 2Kr 5,1–10" />
              </Form.Item>
              <Form.Item<EditorValues> label="Liturgical note" name="liturgicalNote">
                <Input
                  aria-label="Liturgical note"
                  maxLength={500}
                  placeholder="Optional liturgical note"
                />
              </Form.Item>
              <Form.Item<EditorValues> label="References" name="references">
                <Input aria-label="References" maxLength={2000} placeholder="Optional references" />
              </Form.Item>
              <Form.Item<EditorValues> label="Active" name="isActive" valuePropName="checked">
                <Switch aria-label="Active" />
              </Form.Item>
            </div>
            <GeneralPrayerBodyField />
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-500">Version {prayer.version}</span>
              {canUpdate && (
                <SiteButton loading={saving} onClick={() => form.submit()} size="md">
                  Save changes
                </SiteButton>
              )}
            </div>
          </Form>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="bg-white rounded-2xl border border-[#dde0e4] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-primary-900 m-0">Audio</h2>
              <StatusChip status={prayer.audioStatus} />
            </div>
            {prayer.audioGeneratedAt && (
              <p className="text-xs text-neutral-500 m-0">
                Generated at {new Date(prayer.audioGeneratedAt).toLocaleString('en-GB')}
              </p>
            )}
            {audioPanel.alert ? <Alert {...audioPanel.alert} /> : audioPanel.body}
            {canUpdate && (
              <div>
                <SiteButton
                  disabled={generateDisabled}
                  loading={enqueueing}
                  onClick={() =>
                    void onEnqueueAudio()
                      .then(() => setAwaitingAudio(true))
                      .catch(() => undefined)
                  }
                  size="md"
                >
                  {prayer.audioStatus === 'READY' ? 'Regenerate audio' : 'Generate audio'}
                </SiteButton>
                {bodyLength === 0 && (
                  <div className="mt-2 text-xs text-neutral-500">Write the prayer text first.</div>
                )}
              </div>
            )}
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-semibold text-primary-900">
              Preview the saved text
            </summary>
            <div className="mt-2 rounded-xl bg-[#edf4ff] p-4">
              {prayer.introduction && (
                <RichTextContent
                  className="leading-relaxed text-neutral-600 mb-4"
                  html={prayer.introduction}
                />
              )}
              <RichTextContent className="leading-relaxed text-neutral-600" html={prayer.body} />
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
