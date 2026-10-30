'use client'

import {
  Alert,
  AutoComplete,
  Button,
  Col,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Tabs,
  Typography,
  Upload,
} from 'antd'
import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PictureOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { DENOMINATION_OPTIONS, TIMEZONE_OPTIONS, WORSHIP_STYLE_OPTIONS } from '@/utils/constant'
import { ServiceTimeEntry, ServiceTimeScheduleInput } from '@/models/service-time'
import { ChurchProfileInput, ChurchProfileOutput } from '@/models/church'
import FormChurchServiceTimes from '../church-service-times'
import { GoogleMapPicker } from '@/components/common/google-map'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import axios from 'axios'
import { useEffect, useState } from 'react'
import UploadBox from '@/components/common/upload-box'
import PastorImage from '@/components/common/pastor-image'
import { useChurchPastorAssignments } from '@/hooks/data/central'
import { useMediaUpload } from '@/hooks/data/media-upload'
import { ChurchPastorSummary } from '@/models/pastor'
import { useAccessPermission } from '@/hooks/data/access-permission'
dayjs.extend(customParseFormat)

export type ChurchProfileTabKey = 'details' | 'location' | 'pastors' | 'service-times' | 'gallery'

interface FormChurchProfileTabsProps {
  initialValues: ChurchProfileOutput
  serviceTimes: ServiceTimeEntry[]
  churchId: string
  loading?: boolean
  visibleTabs?: ChurchProfileTabKey[]
  onSubmit: (payload: ChurchProfileInput) => Promise<ChurchProfileOutput | undefined>
  onSubmitSchedule: (payload: ServiceTimeScheduleInput) => Promise<unknown>
}

const LANGUAGE_CODES = ['en', 'et', 'fi']
const SOCIAL_PLATFORM_OPTIONS = [
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Linkedin', label: 'Linkedin' },
  { value: 'Twitter', label: 'Twitter' },
  { value: 'YouTube', label: 'YouTube' },
]

const NORMALIZE_PLATFORM: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  'TIK-TOK': 'TikTok',
  TIKTOK: 'TikTok',
  LINKEDIN: 'Linkedin',
  TWITTER: 'Twitter',
  YOUTUBE: 'YouTube',
}

const toRows = (list: ServiceTimeEntry[]) =>
  list.map((st) => ({
    weekday: st.weekday,
    localTime: dayjs(`1970-01-01 ${st.localTime}`, 'YYYY-MM-DD HH:mm'),
    label: st.label ?? undefined,
    languageCode: st.languageCode ?? undefined,
  }))

const toPayload = (
  rows:
    | Array<{ weekday?: number; localTime?: dayjs.Dayjs; label?: string; languageCode?: string }>
    | undefined,
) =>
  (rows ?? [])
    .filter((r) => r.weekday != null && r.localTime != null)
    .map((r) => ({
      weekday: r.weekday!,
      localTime: r.localTime!.format('HH:mm'),
      ...(r.label?.trim() ? { label: r.label.trim() } : {}),
      ...(r.languageCode ? { languageCode: r.languageCode } : {}),
    }))

export default function FormChurchProfileTabs({
  initialValues,
  serviceTimes,
  churchId,
  loading,
  visibleTabs,
  onSubmit,
  onSubmitSchedule,
}: FormChurchProfileTabsProps) {
  const router = useRouter()
  const [form] = Form.useForm<ChurchProfileInput>()
  const {
    data: pastors = [],
    fetching: pastorsLoading,
    updating: isSavingPastor,
    error: pastorsError,
    onUpdate: updatePastorAssignment,
  } = useChurchPastorAssignments({ churchId })
  const pastorPermission = useAccessPermission()
  const canEditPastorAssignment =
    pastorPermission.updateAny('prayer_pastor').granted ||
    pastorPermission.updateOwn('prayer_pastor').granted

  const isDirectImageUrl = (val: string | null): boolean =>
    Boolean(
      val &&
      (val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('blob:') ||
        val.startsWith('data:')),
    )

  const [coverAsset, setCoverAsset] = useState<{ assetId: string | null; url: string | null }>({
    assetId: initialValues.coverAssetId ?? null,
    url: initialValues.coverAssetId
      ? `/api/v1/uploads/${initialValues.coverAssetId}/access?churchId=${encodeURIComponent(churchId)}`
      : null,
  })
  const [coverPresignedUrl, setCoverPresignedUrl] = useState<string | null>(null)
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!coverAsset.assetId || isDirectImageUrl(coverAsset.url)) {
      return
    }

    axios
      .get(`/api/v1/uploads/${encodeURIComponent(coverAsset.assetId)}/access`, {
        params: { churchId },
      })
      .then((res) => {
        if (active) {
          const resolvedUrl = (res.data?.result?.url as string) ?? null
          setCoverPresignedUrl(resolvedUrl)
        }
      })
      .catch(() => {
        if (active) setCoverPresignedUrl(null)
      })

    return () => {
      active = false
    }
  }, [churchId, coverAsset.assetId, coverAsset.url])

  const directCoverUrl = isDirectImageUrl(coverAsset.url) ? coverAsset.url : null
  const displayCoverUrl =
    directCoverUrl || (isDirectImageUrl(coverPresignedUrl) ? coverPresignedUrl : null)

  const hasCoverImage = Boolean(
    (coverAsset.assetId || directCoverUrl) && displayCoverUrl && displayCoverUrl !== failedCoverUrl,
  )
  const [coverUploading, setCoverUploading] = useState(false)
  const { onUpload: uploadCoverImage } = useMediaUpload({ churchId, purpose: 'IMAGE' })
  const [heroAsset, setHeroAsset] = useState<{ assetId: string | null; url: string | null }>({
    assetId: initialValues.heroAssetId ?? null,
    url: initialValues.heroAssetId
      ? `/api/v1/uploads/${initialValues.heroAssetId}/access?churchId=${encodeURIComponent(churchId)}`
      : null,
  })
  const [heroPresignedUrl, setHeroPresignedUrl] = useState<string | null>(null)
  const [failedHeroUrl, setFailedHeroUrl] = useState<string | null>(null)
  const [heroUploading, setHeroUploading] = useState(false)
  const { onUpload: uploadHeroImage } = useMediaUpload({ churchId, purpose: 'IMAGE' })

  useEffect(() => {
    let active = true

    if (!heroAsset.assetId || isDirectImageUrl(heroAsset.url)) {
      return
    }

    axios
      .get(`/api/v1/uploads/${encodeURIComponent(heroAsset.assetId)}/access`, {
        params: { churchId },
      })
      .then((res) => {
        if (active) {
          const resolvedUrl = (res.data?.result?.url as string) ?? null
          setHeroPresignedUrl(resolvedUrl)
        }
      })
      .catch(() => {
        if (active) setHeroPresignedUrl(null)
      })

    return () => {
      active = false
    }
  }, [churchId, heroAsset.assetId, heroAsset.url])

  const directHeroUrl = isDirectImageUrl(heroAsset.url) ? heroAsset.url : null
  const displayHeroUrl =
    directHeroUrl || (isDirectImageUrl(heroPresignedUrl) ? heroPresignedUrl : null)

  const hasHeroImage = Boolean(
    (heroAsset.assetId || directHeroUrl) && displayHeroUrl && displayHeroUrl !== failedHeroUrl,
  )

  const [editingPastor, setEditingPastor] = useState<ChurchPastorSummary | null>(null)
  const [editingPastorImage, setEditingPastorImage] = useState<{
    url: string | null
    assetId?: string | null
    file?: File | null
  }>({ url: null, assetId: null })
  const { onUpload: uploadPastorImage } = useMediaUpload({ churchId, purpose: 'IMAGE' })
  const [galleryItems, setGalleryItems] = useState<
    Array<{
      id?: string
      mediaAssetId: string
      url?: string | null
      caption?: string | null
      orderIndex: number
    }>
  >(
    (initialValues.galleryItems ?? []).map((g, idx) => ({
      id: g.id,
      mediaAssetId: g.mediaAssetId,
      url: g.url ?? null,
      caption: g.caption ?? '',
      orderIndex: g.orderIndex ?? idx,
    })),
  )
  const [pickerCoords, setPickerCoords] = useState<{ latitude: number; longitude: number } | null>(
    initialValues.coordinates ?? null,
  )
  const [galleryUploading, setGalleryUploading] = useState(false)
  const { onUpload: uploadGalleryImage } = useMediaUpload({ churchId, purpose: 'IMAGE' })

  const address = (initialValues.address ?? {}) as {
    line1?: string
    line2?: string
    city?: string
    postalCode?: string
    countryCode?: string
  }
  const contacts = (initialValues.contacts ?? {}) as { email?: string; phone?: string }
  const socialLinks = Array.isArray(initialValues.socialLinks)
    ? (initialValues.socialLinks as Array<{ label: string; url: string }>).map((s) => ({
        ...s,
        label: (s.label ? NORMALIZE_PLATFORM[s.label.toUpperCase()] : undefined) ?? s.label,
      }))
    : []

  const handleSubmit = async () => {
    // @ts-expect-error schedule is part of the form values but not the profile input type
    const { schedule, ...rawValues } = await form.validateFields()
    const values = rawValues as ChurchProfileInput
    const {
      id: _id,
      status: _status,
      approved_by: _ab,
      approved_at: _aa,
      organization: _org,
      ...baseProfile
    } = initialValues as Record<string, unknown>

    const addressPayload = {
      ...(initialValues.address || {}),
      ...(values.address || {}),
    } as Record<string, unknown>
    if (addressPayload.line2 === null) delete addressPayload.line2
    if (addressPayload.postalCode === null) delete addressPayload.postalCode
    if (addressPayload.countryCode === null) delete addressPayload.countryCode

    const contactsPayload = {
      ...(initialValues.contacts || {}),
      ...(values.contacts || {}),
    } as Record<string, unknown>
    if (contactsPayload.email === null) delete contactsPayload.email
    if (contactsPayload.phone === null) delete contactsPayload.phone

    const cleanValues = values

    const payload = {
      ...baseProfile,
      ...cleanValues,
      address: addressPayload,
      contacts: contactsPayload,
      coverAssetId: coverAsset.assetId ?? null,
      heroAssetId: heroAsset.assetId ?? null,
      galleryItems: galleryItems.map((g, idx) => ({
        id: g.id,
        mediaAssetId: g.mediaAssetId,
        caption: g.caption || null,
        orderIndex: idx,
      })),
    } as Record<string, unknown>
    delete payload.coordinates
    payload.coordinates = pickerCoords
    const profilePayload = payload as ChurchProfileInput
    let profileResult: ChurchProfileOutput | undefined
    try {
      profileResult = await onSubmit(profilePayload)
    } catch (_e) {
      return // Profile update failed, skip schedule update
    }

    const nextSchedule = toPayload(schedule)
    const prevSchedule = toRows(serviceTimes)
    const changed = JSON.stringify(nextSchedule) !== JSON.stringify(toPayload(prevSchedule))
    if (changed && profileResult?.version) {
      await onSubmitSchedule({ version: profileResult.version, schedule: nextSchedule })
    }
  }

  const tabItems = [
    {
      key: 'details',
      label: 'Details',
      forceRender: true,
      children: (
        <div className="border border-[#DDE0E4] rounded-lg p-4 sm:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
          <div className="flex-1 min-w-0 w-full lg:max-w-[720px] flex flex-col gap-4">
            {/* Placement */}
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-[#393E46]">Placement</span>
              <div className="h-12 rounded-lg border border-[#DDE0E4] px-3.5 flex items-center bg-white text-sm text-[#393E46]">
                {initialValues.organization && initialValues.organization.length > 0
                  ? initialValues.organization.join(' / ')
                  : 'Not placed in the hierarchy'}
              </div>
              <span className="text-xs text-[#8F96A3]">
                Placement is set when the Church is created. Move it from Central to Hierarchy
              </span>
            </div>

            {/* Timezone */}
            <Form.Item
              name="timezone"
              label={<span className="text-sm font-semibold text-[#393E46]">Timezone</span>}
              rules={[{ required: true, message: 'Please select timezone' }]}
              className="!mb-0"
            >
              <Select
                showSearch
                options={TIMEZONE_OPTIONS}
                placeholder="Select timezone"
                className="h-12 w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[46px]"
                filterOption={(input, option) =>
                  Boolean(
                    option?.value &&
                    String(option.value).toLowerCase().includes(input.toLowerCase()),
                  )
                }
              />
            </Form.Item>

            {/* Denomination and Worship style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="denomination"
                label={<span className="text-sm font-semibold text-[#393E46]">Denomination</span>}
                className="!mb-0"
              >
                <AutoComplete
                  options={DENOMINATION_OPTIONS}
                  placeholder="e.g. Lutheran, Baptist"
                  filterOption={(inputValue, option) =>
                    Boolean(
                      option?.value &&
                      String(option.value).toLowerCase().includes(inputValue.toLowerCase()),
                    )
                  }
                  className="w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-search-input]:!h-12"
                />
              </Form.Item>
              <Form.Item
                name="churchStyle"
                label={<span className="text-sm font-semibold text-[#393E46]">Worship style</span>}
                className="!mb-0"
              >
                <AutoComplete
                  options={WORSHIP_STYLE_OPTIONS}
                  placeholder="e.g. Traditional, Contemporary"
                  filterOption={(inputValue, option) =>
                    Boolean(
                      option?.value &&
                      String(option.value).toLowerCase().includes(inputValue.toLowerCase()),
                    )
                  }
                  className="w-full [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-search-input]:!h-12"
                />
              </Form.Item>
            </div>

            {/* Profile basics */}
            <Form.Item
              name="description"
              label={<span className="text-sm font-semibold text-[#393E46]">Profile basics</span>}
              className="!mb-0"
            >
              <Input.TextArea
                placeholder="A short introduction to the church community."
                rows={4}
                maxLength={2000}
                showCount
                className="!min-h-[120px] !rounded-lg !border-[#DDE0E4] p-3 text-sm text-[#393E46]"
              />
            </Form.Item>

            {/* Languages */}
            <Form.Item
              name="languageCodes"
              label={<span className="text-sm font-semibold text-[#393E46]">Languages</span>}
              rules={[{ required: true, message: 'Select at least one language' }]}
              className="!mb-0"
            >
              <Select
                mode="multiple"
                placeholder="Select languages"
                className="w-full [&_.ant-select-selector]:!min-h-[48px] [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4]"
                tagRender={({ label, closable, onClose }) => (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 mr-1.5 my-1 rounded-lg bg-[#E6EDFB] text-sm font-medium text-[#393E46]">
                    {label}
                    {closable && (
                      <span
                        onClick={onClose}
                        className="cursor-pointer text-xs text-[#5C6370] hover:text-[#0E203E]"
                      >
                        ×
                      </span>
                    )}
                  </span>
                )}
                options={LANGUAGE_CODES.map((code) => ({
                  label: code.toUpperCase(),
                  value: code,
                }))}
              />
            </Form.Item>
          </div>

          {/* Right column: Cover Image */}
          <div className="w-full lg:w-[382px] flex-none flex flex-col gap-6">
            {/* Cover Image */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#393E46]">Cover Image</span>
              {hasCoverImage ? (
                <div className="relative group w-full h-[176px] rounded-lg overflow-hidden border border-slate-200/80 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayCoverUrl || ''}
                    alt="Cover"
                    className="w-full h-full object-cover rounded-lg"
                    onError={() => setFailedCoverUrl(displayCoverUrl)}
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
                    <Upload
                      name="file"
                      showUploadList={false}
                      multiple={false}
                      accept="image/*"
                      customRequest={async ({ file, onSuccess, onError }) => {
                        setCoverUploading(true)
                        try {
                          const res = await uploadCoverImage(file as File)
                          if (res?.assetId && res.url) {
                            setFailedCoverUrl(null)
                            setCoverAsset({ assetId: res.assetId, url: res.url })
                            setCoverPresignedUrl(res.url)
                            form.setFieldValue('coverAssetId', res.assetId)
                            onSuccess?.('ok')
                          }
                        } catch (err) {
                          onError?.(err as Error)
                        } finally {
                          setCoverUploading(false)
                        }
                      }}
                      className="pointer-events-auto"
                    >
                      <button
                        type="button"
                        disabled={coverUploading}
                        className="bg-white rounded-lg shadow-sm border border-neutral-200/90 px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-[#2F7AD2] hover:bg-neutral-50 transition-colors cursor-pointer"
                        aria-label="Change image"
                      >
                        <span>Change image</span>
                        {coverUploading ? (
                          <LoadingOutlined
                            style={{ color: '#2F7AD2' }}
                            className="text-sm !text-[#2F7AD2]"
                          />
                        ) : (
                          <UploadOutlined
                            style={{ color: '#2F7AD2' }}
                            className="text-sm !text-[#2F7AD2]"
                          />
                        )}
                      </button>
                    </Upload>

                    <button
                      type="button"
                      onClick={() => {
                        setFailedCoverUrl(null)
                        setCoverPresignedUrl(null)
                        setCoverAsset({ assetId: null, url: null })
                        form.setFieldValue('coverAssetId', null)
                      }}
                      className="bg-white rounded-lg shadow-sm border border-neutral-200/90 w-9 h-9 flex items-center justify-center text-[#E02424] hover:bg-neutral-50 transition-colors cursor-pointer pointer-events-auto"
                      aria-label="Delete cover image"
                    >
                      <DeleteOutlined className="text-base text-[#E02424]" />
                    </button>
                  </div>
                </div>
              ) : (
                <Upload
                  name="file"
                  showUploadList={false}
                  multiple={false}
                  accept="image/*"
                  customRequest={async ({ file, onSuccess, onError }) => {
                    setCoverUploading(true)
                    try {
                      const res = await uploadCoverImage(file as File)
                      if (res?.assetId && res.url) {
                        setFailedCoverUrl(null)
                        setCoverAsset({ assetId: res.assetId, url: res.url })
                        form.setFieldValue('coverAssetId', res.assetId)
                        onSuccess?.('ok')
                      }
                    } catch (err) {
                      onError?.(err as Error)
                    } finally {
                      setCoverUploading(false)
                    }
                  }}
                  className="w-full block [&_.ant-upload]:!w-full [&_.ant-upload]:!block [&_.ant-upload-select]:!w-full [&_.ant-upload-select]:!block [&_.ant-upload-btn]:!w-full [&_.ant-upload-btn]:!block"
                >
                  <div className="w-full bg-[#F5F7FF] rounded-lg p-2">
                    <div className="h-[176px] w-full rounded-md border border-dashed border-[#C8D7F3] flex flex-col items-center justify-center gap-2 hover:border-[#2F7AD2] transition-colors cursor-pointer">
                      {coverUploading ? (
                        <LoadingOutlined
                          style={{ color: '#2F7AD2' }}
                          className="text-2xl !text-[#2F7AD2]"
                        />
                      ) : (
                        <UploadOutlined
                          style={{ color: '#2F7AD2' }}
                          className="text-2xl !text-[#2F7AD2]"
                        />
                      )}
                      <span className="text-sm font-semibold text-[#2F7AD2]">Upload</span>
                    </div>
                  </div>
                </Upload>
              )}
            </div>

            {/* Hero Image */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#393E46]">Hero Image</span>
              {hasHeroImage ? (
                <div className="relative group w-full h-[176px] rounded-lg overflow-hidden border border-slate-200/80 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={displayHeroUrl || ''}
                    alt="Hero"
                    className="w-full h-full object-cover rounded-lg"
                    onError={() => setFailedHeroUrl(displayHeroUrl)}
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pointer-events-none">
                    <Upload
                      name="heroFile"
                      showUploadList={false}
                      multiple={false}
                      accept="image/*"
                      customRequest={async ({ file, onSuccess, onError }) => {
                        setHeroUploading(true)
                        try {
                          const res = await uploadHeroImage(file as File)
                          if (res?.assetId && res.url) {
                            setFailedHeroUrl(null)
                            setHeroAsset({ assetId: res.assetId, url: res.url })
                            setHeroPresignedUrl(res.url)
                            form.setFieldValue('heroAssetId', res.assetId)
                            onSuccess?.('ok')
                          }
                        } catch (err) {
                          onError?.(err as Error)
                        } finally {
                          setHeroUploading(false)
                        }
                      }}
                      className="pointer-events-auto"
                    >
                      <button
                        type="button"
                        disabled={heroUploading}
                        className="bg-white rounded-lg shadow-sm border border-neutral-200/90 px-3 py-1.5 flex items-center gap-2 text-sm font-medium text-[#2F7AD2] hover:bg-neutral-50 transition-colors cursor-pointer"
                        aria-label="Change hero image"
                      >
                        <span>Change image</span>
                        {heroUploading ? (
                          <LoadingOutlined
                            style={{ color: '#2F7AD2' }}
                            className="text-sm !text-[#2F7AD2]"
                          />
                        ) : (
                          <UploadOutlined
                            style={{ color: '#2F7AD2' }}
                            className="text-sm !text-[#2F7AD2]"
                          />
                        )}
                      </button>
                    </Upload>

                    <button
                      type="button"
                      onClick={() => {
                        setFailedHeroUrl(null)
                        setHeroPresignedUrl(null)
                        setHeroAsset({ assetId: null, url: null })
                        form.setFieldValue('heroAssetId', null)
                      }}
                      className="bg-white rounded-lg shadow-sm border border-neutral-200/90 w-9 h-9 flex items-center justify-center text-[#E02424] hover:bg-neutral-50 transition-colors cursor-pointer pointer-events-auto"
                      aria-label="Delete hero image"
                    >
                      <DeleteOutlined className="text-base text-[#E02424]" />
                    </button>
                  </div>
                </div>
              ) : (
                <Upload
                  name="heroFile"
                  showUploadList={false}
                  multiple={false}
                  accept="image/*"
                  customRequest={async ({ file, onSuccess, onError }) => {
                    setHeroUploading(true)
                    try {
                      const res = await uploadHeroImage(file as File)
                      if (res?.assetId && res.url) {
                        setFailedHeroUrl(null)
                        setHeroAsset({ assetId: res.assetId, url: res.url })
                        form.setFieldValue('heroAssetId', res.assetId)
                        onSuccess?.('ok')
                      }
                    } catch (err) {
                      onError?.(err as Error)
                    } finally {
                      setHeroUploading(false)
                    }
                  }}
                  className="w-full block [&_.ant-upload]:!w-full [&_.ant-upload]:!block [&_.ant-upload-select]:!w-full [&_.ant-upload-select]:!block [&_.ant-upload-btn]:!w-full [&_.ant-upload-btn]:!block"
                >
                  <div className="w-full bg-[#F5F7FF] rounded-lg p-2">
                    <div className="h-[176px] w-full rounded-md border border-dashed border-[#C8D7F3] flex flex-col items-center justify-center gap-2 hover:border-[#2F7AD2] transition-colors cursor-pointer">
                      {heroUploading ? (
                        <LoadingOutlined
                          style={{ color: '#2F7AD2' }}
                          className="text-2xl !text-[#2F7AD2]"
                        />
                      ) : (
                        <UploadOutlined
                          style={{ color: '#2F7AD2' }}
                          className="text-2xl !text-[#2F7AD2]"
                        />
                      )}
                      <span className="text-sm font-semibold text-[#2F7AD2]">Upload</span>
                    </div>
                  </div>
                </Upload>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location & Contact',
      forceRender: true,
      children: (
        <div className="border border-[#DDE0E4] rounded-lg p-4">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 min-w-0 w-full lg:max-w-[560px] flex flex-col gap-4">
              <Form.Item
                name={['address', 'line1']}
                label={<span className="text-sm font-semibold text-[#393E46]">Address</span>}
                rules={[{ required: true, message: 'Please input address line' }]}
                className="!mb-0"
              >
                <Input
                  placeholder="Church address"
                  className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                />
              </Form.Item>
              <Form.Item
                name={['address', 'city']}
                label={<span className="text-sm font-semibold text-[#393E46]">City</span>}
                rules={[{ required: true, message: 'Please input city' }]}
                className="!mb-0"
              >
                <Input
                  placeholder="Tallinn"
                  className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                />
              </Form.Item>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Form.Item
                  name={['contacts', 'email']}
                  label={
                    <span className="text-sm font-semibold text-[#393E46]">Email address</span>
                  }
                  className="!mb-0"
                >
                  <Input
                    placeholder="Church email"
                    className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                  />
                </Form.Item>
                <Form.Item
                  name={['contacts', 'phone']}
                  label={<span className="text-sm font-semibold text-[#393E46]">Phone number</span>}
                  className="!mb-0"
                >
                  <Input
                    placeholder="Telephone"
                    className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                  />
                </Form.Item>
              </div>
              <Form.Item
                name="website"
                label={<span className="text-sm font-semibold text-[#393E46]">Website</span>}
                className="!mb-0"
              >
                <Input
                  placeholder="https://example.org"
                  className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                />
              </Form.Item>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-[#393E46]">Social Links</span>
                <Form.List name="socialLinks">
                  {(fields, { add, remove }) => (
                    <div className="flex flex-col gap-2">
                      {fields.map(({ key, name, ...restField }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Form.Item {...restField} name={[name, 'label']} className="!mb-0">
                            <Select
                              placeholder="Facebook"
                              options={SOCIAL_PLATFORM_OPTIONS}
                              className="!h-12 w-[160px] shrink-0 [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!leading-[46px] [&_.ant-select-selection-placeholder]:!leading-[46px] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
                            />
                          </Form.Item>
                          <Form.Item {...restField} name={[name, 'url']} className="!mb-0 flex-1">
                            <Input
                              placeholder="https://facebook.com/..."
                              className="!h-12 !rounded-lg !border-[#737C8C] !px-4 text-sm text-[#393E46]"
                            />
                          </Form.Item>
                          <Button
                            type="primary"
                            danger
                            aria-label="Remove social link"
                            onClick={() => remove(name)}
                            className="!h-12 !w-12 !p-0 !rounded-xl !bg-[#E64C4C] !border-[#E64C4C] flex items-center justify-center shrink-0 hover:!bg-[#D93838]"
                          >
                            <DeleteOutlined className="text-lg text-white" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        className="!h-[39px] w-full !rounded-md !border-dashed !border-[#B0B6BF] !text-[#5C6370] text-sm font-semibold flex items-center justify-center gap-2 hover:!border-primary-500 hover:!text-primary-500"
                      >
                        <span>Add social link</span>
                        <PlusOutlined className="text-sm text-[#5C6370]" />
                      </Button>
                    </div>
                  )}
                </Form.List>
              </div>
            </div>
            <div className="w-full lg:w-[542px] flex-none">
              <GoogleMapPicker
                label="Church location"
                latitude={pickerCoords?.latitude}
                longitude={pickerCoords?.longitude}
                onChange={(next) => setPickerCoords(next)}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'pastors',
      label: 'Pastors',
      forceRender: true,
      children: (
        <div className="border border-[#DDE0E4] rounded-lg p-4 sm:p-6">
          {pastorsLoading ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : pastorsError ? (
            <Alert
              type="error"
              showIcon
              message="Assigned pastors could not be loaded"
              description="Refresh the page or try again shortly."
            />
          ) : pastors.length === 0 ? (
            <Empty description="No pastors are assigned to this church." />
          ) : (
            <>
              <div className="bg-gray-100 p-2 font-semibold mb-2">
                <Row gutter={16}>
                  <Col span={3}>Photo</Col>
                  <Col span={6}>Pastor name</Col>
                  <Col span={6}>Church role</Col>
                  <Col span={7}>Introduction</Col>
                  {canEditPastorAssignment && <Col span={2}>Action</Col>}
                </Row>
              </div>
              <div className="flex flex-col gap-2">
                {pastors.map((p) => (
                  <Row
                    gutter={16}
                    key={p.id}
                    className="items-center border-b border-gray-100 pb-2"
                  >
                    <Col span={3}>
                      <PastorImage
                        imageAssetId={p.resolvedImageAssetId}
                        churchId={churchId}
                        name={p.name}
                      />
                    </Col>
                    <Col span={6}>{p.name}</Col>
                    <Col span={6}>{p.pastoralRole}</Col>
                    <Col span={7}>{p.introduction ?? '—'}</Col>
                    {canEditPastorAssignment && (
                      <Col span={2}>
                        <Button
                          type="link"
                          className="p-0"
                          onClick={() => {
                            setEditingPastor(p)
                            setEditingPastorImage({
                              assetId: p.imageAssetId,
                              url: p.imageAssetId
                                ? `/api/v1/uploads/${p.imageAssetId}/access?churchId=${encodeURIComponent(churchId)}`
                                : null,
                            })
                          }}
                        >
                          Edit
                        </Button>
                      </Col>
                    )}
                  </Row>
                ))}
              </div>
            </>
          )}
          <div className="mt-4 p-4 bg-gray-50 text-gray-500 rounded text-sm">
            Shared Pastor name, introduction, canonical image, and linked staff identity are managed
            by Central Pastors. This church can edit only its role and optional image override.
          </div>
        </div>
      ),
    },
    {
      key: 'service-times',
      label: 'Service Times',
      forceRender: true,
      children: (
        <div className="border border-[#DDE0E4] rounded-lg p-4 sm:p-6">
          <Typography.Title level={4}>Service schedule</Typography.Title>
          <FormChurchServiceTimes isSaving={loading} />
        </div>
      ),
    },
    {
      key: 'gallery',
      label: 'Gallery',
      forceRender: true,
      children: (
        <div className="border border-[#DDE0E4] rounded-lg p-4 sm:p-6 space-y-6">
          <div>
            <Typography.Title level={4}>Sanctuary Gallery</Typography.Title>
            <Typography.Text type="secondary">
              Photographs of the sanctuary, sacred architecture, stained glass, and altar. These
              images are displayed on the public church profile.
            </Typography.Text>
          </div>

          {galleryItems.length === 0 ? (
            <Empty description="No gallery photos added yet. Upload photos below to display in the sanctuary gallery." />
          ) : (
            <div className="flex flex-col gap-4">
              {galleryItems.map((item, idx) => (
                <div
                  key={item.id || `${item.mediaAssetId}-${idx}`}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-gray-200 rounded-xl bg-white shadow-sm"
                >
                  <div className="relative w-32 h-24 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
                    {item.url ? (
                      <Image
                        src={item.url}
                        alt={item.caption || `Gallery photo ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        className="rounded-lg"
                      />
                    ) : (
                      <PictureOutlined className="text-2xl text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Caption</label>
                    <Input
                      placeholder="e.g. Altar & stained glass"
                      value={item.caption ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setGalleryItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, caption: val } : it)),
                        )
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      disabled={idx === 0}
                      onClick={() => {
                        setGalleryItems((prev) => {
                          const copy = [...prev]
                          const temp = copy[idx - 1]
                          copy[idx - 1] = copy[idx]
                          copy[idx] = temp
                          return copy
                        })
                      }}
                      title="Move Up"
                    />
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      disabled={idx === galleryItems.length - 1}
                      onClick={() => {
                        setGalleryItems((prev) => {
                          const copy = [...prev]
                          const temp = copy[idx + 1]
                          copy[idx + 1] = copy[idx]
                          copy[idx] = temp
                          return copy
                        })
                      }}
                      title="Move Down"
                    />
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        setGalleryItems((prev) => prev.filter((_, i) => i !== idx))
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <Typography.Text strong className="block mb-2">
              Add Photo to Gallery
            </Typography.Text>
            <Upload.Dragger
              name="galleryFile"
              showUploadList={false}
              multiple={false}
              accept="image/*"
              disabled={galleryUploading}
              customRequest={async ({ file, onSuccess, onError }) => {
                setGalleryUploading(true)
                try {
                  const res = await uploadGalleryImage(file as File)
                  if (res?.assetId && res.url) {
                    setGalleryItems((prev) => [
                      ...prev,
                      {
                        mediaAssetId: res.assetId,
                        url: res.url,
                        caption: '',
                        orderIndex: prev.length,
                      },
                    ])
                    onSuccess?.('ok')
                  }
                } catch (err) {
                  onError?.(err as Error)
                } finally {
                  setGalleryUploading(false)
                }
              }}
              className="p-4"
            >
              <p className="ant-upload-drag-icon">
                {galleryUploading ? <LoadingOutlined /> : <PlusOutlined />}
              </p>
              <p className="ant-upload-text">
                {galleryUploading
                  ? 'Uploading image...'
                  : 'Click or drag an image here to add to gallery'}
              </p>
              <p className="ant-upload-hint">Supports JPG, PNG, WEBP</p>
            </Upload.Dragger>
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="max-w-[1184px] mx-auto bg-white rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-100 p-4 sm:p-6 flex flex-col">
        <div className="flex items-center gap-4 mb-4 sm:mb-6">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/churches/${churchId}`)}
            className="w-10 h-10 rounded-lg bg-[#E6EDFB] flex items-center justify-center text-[#2555A7] hover:bg-[#d8e4f8] transition-colors border-0 cursor-pointer flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeftOutlined className="text-sm font-semibold" />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-[#393E46]">Church Name *</span>
            <h2 className="text-2xl font-semibold tracking-[-1px] text-[#0E203E] m-0">
              {initialValues.name}
            </h2>
          </div>
        </div>

        <Form
          layout="vertical"
          initialValues={{
            ...initialValues,
            address,
            contacts,
            socialLinks,
            schedule: toRows(serviceTimes),
          }}
          form={form}
        >
          <Form.Item name="name" hidden>
            <Input />
          </Form.Item>

          <Tabs
            className="church-profile-tabs [&_.ant-tabs-nav]:!mb-4 [&_.ant-tabs-nav]:before:!border-b-0 [&_.ant-tabs-nav-list]:!bg-[#E6EDFB] [&_.ant-tabs-nav-list]:!rounded-xl [&_.ant-tabs-nav-list]:!p-1 [&_.ant-tabs-nav-list]:!gap-1 [&_.ant-tabs-tab]:!m-0 [&_.ant-tabs-tab]:!px-4 [&_.ant-tabs-tab]:!py-1.5 [&_.ant-tabs-tab]:!rounded-lg [&_.ant-tabs-tab]:!border-0 [&_.ant-tabs-tab]:!transition-all [&_.ant-tabs-tab-btn]:!text-xs [&_.ant-tabs-tab-btn]:!font-semibold [&_.ant-tabs-tab-btn]:!text-[#2555A7] [&_.ant-tabs-tab-active]:!bg-white [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:!text-[#0E203E] [&_.ant-tabs-ink-bar]:!hidden"
            items={
              visibleTabs
                ? tabItems.filter((t) => visibleTabs.includes(t.key as ChurchProfileTabKey))
                : tabItems
            }
          />

          <div className="border-t border-[#F1F5F9] pt-4 mt-6 flex justify-end">
            <Button
              type="primary"
              htmlType="button"
              aria-label="Save"
              onClick={handleSubmit}
              loading={loading}
              className="!h-10 !rounded-lg !px-4 !bg-[#2F7AD2] !border-[#2F7AD2] text-sm font-semibold flex items-center gap-2"
            >
              Save
              <CheckOutlined className="text-sm" aria-hidden="true" />
            </Button>
          </div>
        </Form>
      </div>

      <Modal
        title="Edit pastor assignment"
        open={!!editingPastor}
        destroyOnHidden
        footer={null}
        onCancel={() => setEditingPastor(null)}
      >
        {editingPastor && (
          <Form
            layout="vertical"
            initialValues={{
              name: editingPastor.name,
              introduction: editingPastor.introduction,
              pastoralRole: editingPastor.pastoralRole,
            }}
            onFinish={async (values) => {
              try {
                let imageAssetId = editingPastorImage.assetId ?? null
                if (editingPastorImage.file) {
                  const uploaded = await uploadPastorImage(editingPastorImage.file)
                  imageAssetId = uploaded?.assetId ?? null
                }
                await updatePastorAssignment({
                  pastorId: editingPastor.id,
                  payload: {
                    version: initialValues.version,
                    pastoral_role: values.pastoralRole,
                    image_asset_id: imageAssetId,
                  },
                })
                setEditingPastor(null)
              } catch (_e) {
                // The data hook keeps the modal open and displays the API error.
              }
            }}
          >
            <Form.Item name="name" label="Pastor name">
              <Input disabled />
            </Form.Item>
            <Form.Item name="introduction" label="Introduction">
              <Input.TextArea disabled autoSize={{ minRows: 3, maxRows: 6 }} />
            </Form.Item>
            <Form.Item label="Linked staff account">
              <Input
                disabled
                value={
                  editingPastor.user
                    ? `${editingPastor.user.name} (${editingPastor.user.email})`
                    : 'Not linked'
                }
              />
            </Form.Item>
            <Form.Item label="Canonical pastor image">
              <PastorImage
                imageAssetId={editingPastor.profileImageAssetId}
                churchId={churchId}
                name={editingPastor.name}
                size={96}
              />
            </Form.Item>
            <Form.Item
              name="pastoralRole"
              label="Church role"
              rules={[{ required: true, message: 'Please input role' }]}
            >
              <Input placeholder="Pastor" />
            </Form.Item>
            <Form.Item label="Church image override">
              <UploadBox
                formName="imageAssetId"
                churchId={churchId}
                purpose="IMAGE"
                deferUpload
                upload={editingPastorImage}
                setUpload={(val) => {
                  const typedVal = typeof val === 'function' ? val(editingPastorImage) : val
                  setEditingPastorImage(typedVal)
                }}
              />
            </Form.Item>
            <div className="text-right mt-4">
              <Button type="primary" htmlType="submit" loading={isSavingPastor}>
                Save
              </Button>
            </div>
          </Form>
        )}
      </Modal>
    </>
  )
}
