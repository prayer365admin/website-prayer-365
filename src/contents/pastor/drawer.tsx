'use client'

import PastorImage from '@/components/common/pastor-image'
import {
  useAssignPastorToChurch,
  useCentralChurches,
  usePastor,
  usePastorStaffOptions,
  usePastors,
  useUnassignPastorFromChurch,
} from '@/hooks/data/central'
import { useMediaUpload } from '@/hooks/data/media-upload'
import { PastorData } from '@/models/pastor'
import { CameraOutlined, CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Drawer, Select, Skeleton } from 'antd'
import { useEffect, useRef, useState } from 'react'

/**
 * Central Admin/Pastors — Figma `.omp/figma-structures/dashboard-central-pastor.json`.
 * Opening without `pastorId` renders create mode ("New Pastor"); with `pastorId` it
 * loads the profile and edits it. Replaces the former create/edit page routes.
 */
export default function PastorDrawer({
  pastorId,
  onClose,
}: {
  pastorId?: string
  onClose: () => void
}) {
  const detailQuery = usePastor(pastorId ?? '')
  const { data, loading, error } = pastorId
    ? detailQuery
    : { data: undefined, loading: false, error: null }

  return (
    <Drawer
      open
      onClose={onClose}
      size={576}
      placement="right"
      closeIcon={false}
      destroyOnHidden
      rootClassName="[&_.ant-drawer-content]:!rounded-l-2xl [&_.ant-drawer-content-wrapper]:!shadow-[0px_25px_50px_-12px_rgba(14,32,62,0.1)] [&_.ant-drawer-body]:!p-0"
      styles={{ body: { padding: 0 } }}
    >
      <div className="flex h-full flex-col bg-white">
        {/* Header */}
        <div className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-[#DDE0E4] px-4 py-4">
          <h2 className="m-0 text-base font-semibold leading-[24px] text-[#0E203E]">
            {pastorId ? 'Edit Pastor' : 'New Pastor'}
          </h2>
          <button
            type="button"
            aria-label="Close drawer"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#DDE0E4] bg-white text-[#5C6370] hover:border-[#2F7AD2] hover:text-[#2F7AD2]"
          >
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {error ? (
            <Alert
              type="error"
              showIcon
              title="Pastor profile could not be loaded"
              description="Refresh the page or try again shortly."
            />
          ) : pastorId && loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : pastorId && !data ? (
            <Alert type="warning" showIcon title="Pastor profile not found." />
          ) : (
            <PastorDrawerForm key={data?.id ?? 'new'} pastor={data} onClose={onClose} />
          )}
        </div>
      </div>
    </Drawer>
  )
}

type ImageState = {
  assetId: string | null
  churchId: string | null
  /** Object URL for a freshly picked file (preview until save). */
  previewUrl?: string | null
  /** Picked file, uploaded at save time so a new pastor can choose a photo first. */
  file?: File | null
}

function PastorDrawerForm({ pastor, onClose }: { pastor?: PastorData; onClose: () => void }) {
  const { message } = App.useApp()
  // The parent mounts this form only once the detail query resolved (or in create
  // mode), so the loaded profile is a stable initial value, not a synced side effect.
  const [name, setName] = useState(pastor?.name ?? '')
  const [introduction, setIntroduction] = useState(pastor?.introduction ?? '')
  const [userId, setUserId] = useState<string | null>(pastor?.user_id ?? null)
  const [assignments, setAssignments] = useState<Array<{ key: number; churchId: string }>>(() =>
    (pastor?.churches ?? []).map((church, index) => ({ key: index, churchId: church.churchId })),
  )
  const [image, setImage] = useState<ImageState>(() => ({
    assetId: pastor?.imageAssetId ?? null,
    churchId: pastor?.imageChurchId ?? null,
  }))
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const { onCreate, onUpdate } = usePastors({ enableFetch: false })
  const { onAssign, loading: assignLoading } = useAssignPastorToChurch()
  const { onUnassign, loading: unassignLoading } = useUnassignPastorFromChurch()
  const { data: churches, isLoading: churchesLoading } = useCentralChurches()
  const staffQuery = usePastorStaffOptions()

  const pastorId = pastor?.id
  const version = pastor?.version ?? 0

  const firstChurchId = assignments[0]?.churchId ?? image.churchId ?? ''
  const { onUpload, loading: uploading } = useMediaUpload({
    churchId: firstChurchId,
    purpose: 'IMAGE',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The picked file is uploaded during save, so a pastor that has no church yet can
  // still choose a photo; the upload context comes from the church assigned on save.
  const handlePhotoPicked = (file: File | undefined) => {
    if (!file) return
    setImage({
      assetId: null,
      churchId: null,
      previewUrl: URL.createObjectURL(file),
      file,
    })
  }

  const handleRemovePhoto = () => {
    // The cleanup effect below revokes the preview URL when this state changes.
    setImage({ assetId: null, churchId: null, previewUrl: null, file: null })
  }

  // Release the local preview object URL when it is replaced or the drawer unmounts.
  useEffect(
    () => () => {
      if (image.previewUrl) URL.revokeObjectURL(image.previewUrl)
    },
    [image.previewUrl],
  )

  const handleSubmit = async () => {
    if (!name.trim()) {
      message.error('Enter the pastor’s name.')
      return
    }
    const seen = new Set<string>()
    const uniqueAssignments = assignments.filter((assignment) => {
      if (!assignment.churchId || seen.has(assignment.churchId)) return false
      seen.add(assignment.churchId)
      return true
    })
    setSaving(true)
    setWarning(null)
    try {
      let imageAssetId = image.assetId
      if (image.file) {
        const uploadChurchId = uniqueAssignments[0]?.churchId ?? image.churchId ?? ''
        if (!uploadChurchId) {
          message.warning('Add a church before saving the profile photo.')
          return
        }
        const uploaded = await onUpload(image.file)
        imageAssetId = uploaded?.assetId ?? null
        if (!imageAssetId) return
      }
      if (pastorId) {
        // Edit: the verified diff logic from the former edit page (assign new,
        // unassign removed, skip the profile save when relationship changes fail).
        const currentChurches = new Set(uniqueAssignments.map((a) => a.churchId))
        if (imageAssetId && image.churchId && !currentChurches.has(image.churchId)) {
          setWarning(
            'The profile photo belongs to a church that is no longer assigned. Keep that church assigned or remove the photo before saving.',
          )
          return
        }
        const results = await Promise.allSettled([
          ...uniqueAssignments.map((assignment) =>
            onAssign({
              churchId: assignment.churchId,
              assigned: { pastorId },
            }),
          ),
          ...(pastor?.churches ?? [])
            .filter((church) => !currentChurches.has(church.churchId))
            .map((church) => onUnassign({ churchId: church.churchId, pastorId })),
        ])
        const failed = results.filter(({ status }) => status === 'rejected').length
        if (failed > 0) {
          setWarning(
            `${failed} church assignment change${failed === 1 ? '' : 's'} failed, so the profile changes were not saved. Review the selections and save again.`,
          )
          return
        }
        await onUpdate({
          pastorId,
          payload: {
            version,
            name: name.trim(),
            introduction: introduction.trim() || null,
            imageAssetId,
            userId: userId ?? null,
          },
        })
        onClose()
      } else {
        // Create: the former create page flow (create → assign → version-1 image update).
        const response = await onCreate({
          name: name.trim(),
          introduction: introduction.trim() || null,
          userId: userId ?? null,
        })
        const newPastorId = response.data.result.id as string
        const results = await Promise.allSettled(
          uniqueAssignments.map((assignment) =>
            onAssign({
              churchId: assignment.churchId,
              assigned: { pastorId: newPastorId },
            }),
          ),
        )
        if (results.some(({ status }) => status === 'rejected')) {
          message.warning(
            'The pastor was created, but one or more church assignments failed. Open the pastor to retry.',
          )
          onClose()
          return
        }
        if (imageAssetId) {
          await onUpdate({
            pastorId: newPastorId,
            payload: { version: 1, imageAssetId },
          })
        }
        onClose()
      }
    } catch {
      // Mutation hooks display the actionable API error; keep the drawer open for correction.
    } finally {
      setSaving(false)
    }
  }

  const churchOptions = (churches ?? []).map((church) => ({
    label:
      church.name + (church.status === 'APPROVED' ? '' : ' (' + church.status.toLowerCase() + ')'),
    value: church.id,
  }))
  const staffOptions = (staffQuery.data ?? []).map((user) => ({
    label: `${user.name} (${user.email})`,
    value: user.id,
  }))

  return (
    <div className="flex flex-col gap-5">
      {warning && (
        <Alert
          type="warning"
          showIcon
          title="Church assignments need attention"
          description={warning}
          closable={{ onClose: () => setWarning(null) }}
        />
      )}

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-[#393E46]" htmlFor="pastor-drawer-name">
          Name
        </label>
        <input
          id="pastor-drawer-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={200}
          placeholder="Pastor Daniel Carter"
          className="h-12 w-full rounded-lg border border-[#737C8C] bg-white px-4 text-sm text-[#393E46] outline-none placeholder:text-[#393E46]/45 focus:border-[#2F7AD2]"
        />
      </div>

      {/* Photo block */}
      <div className="flex items-center gap-4 rounded-xl bg-[#F5F7FF] p-2">
        {image.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.previewUrl}
            alt="Pastor photo preview"
            className="h-[131px] w-[131px] shrink-0 rounded-lg object-cover shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]"
          />
        ) : (
          <PastorImage
            imageAssetId={image.assetId}
            churchId={image.churchId}
            name={name || 'Pastor'}
            size={131}
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <p className="m-0 text-sm leading-[21px] text-[#5C6370]">
            Your profile picture and sacramental affiliation name are visible to prayer group
            leaders, fellowship coordinators, and pastoral clergy.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                handlePhotoPicked(event.target.files?.[0])
                event.target.value = ''
              }}
            />
            <Button
              type="primary"
              icon={<CameraOutlined />}
              loading={uploading || saving}
              disabled={saving}
              className="!h-8 !rounded-lg !bg-[#2F7AD2] !px-3 !text-xs !font-semibold"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Photo
            </Button>
            <Button
              type="default"
              disabled={!image.assetId && !image.previewUrl}
              className="!h-8 !rounded-lg !border-[#2F7AD2] !bg-white !px-3 !text-xs !font-semibold !text-[#2F7AD2]"
              onClick={handleRemovePhoto}
            >
              Remove
            </Button>
          </div>
        </div>
      </div>

      {/* Introduction */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-[#393E46]" htmlFor="pastor-drawer-intro">
          Introduction
        </label>
        <textarea
          id="pastor-drawer-intro"
          value={introduction}
          onChange={(event) => setIntroduction(event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Chaplain coordinating diaconal outreach, elder support, and family pastoral care."
          className="w-full resize-y rounded-lg border border-[#737C8C] bg-white px-4 py-3 text-sm text-[#0E203E] outline-none placeholder:text-[#0E203E]/45 focus:border-[#2F7AD2]"
        />
      </div>

      {/* Linked staff account */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-[#393E46]" htmlFor="pastor-drawer-staff">
          Linked Staff Account
        </label>
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          loading={staffQuery.isLoading}
          placeholder="Select a staff account"
          value={userId ?? undefined}
          onChange={(value) => setUserId(value ?? null)}
          options={staffOptions}
          className="h-12 [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
        />
      </div>

      {/* Church assignments */}
      <div className="flex flex-col gap-3">
        {assignments.map((assignment, index) => (
          <div key={assignment.key} className="flex flex-col gap-2.5">
            <label className="text-sm font-semibold text-[#393E46]">Church</label>
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              loading={churchesLoading}
              placeholder="Select a church"
              value={assignment.churchId || undefined}
              onChange={(value) =>
                setAssignments((list) =>
                  list.map((item, i) =>
                    i === index ? { ...item, churchId: (value as string) ?? '' } : item,
                  ),
                )
              }
              options={churchOptions.filter(
                (option) =>
                  !assignments.some((item, i) => item.churchId === option.value && i !== index),
              )}
              className="h-12 [&_.ant-select-selector]:!h-12 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#737C8C] [&_.ant-select-selection-item]:!text-sm [&_.ant-select-selection-item]:!text-[#393E46]"
            />
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 self-start text-sm font-semibold text-[#DF2020] hover:opacity-80"
              onClick={() => setAssignments((list) => list.filter((_, i) => i !== index))}
            >
              Remove church assignment
            </button>
          </div>
        ))}

        <button
          type="button"
          className="flex h-[39px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#B0B6BF] text-sm font-semibold text-[#5C6370] hover:border-[#2F7AD2] hover:text-[#2F7AD2]"
          onClick={() => setAssignments((list) => [...list, { key: Date.now(), churchId: '' }])}
        >
          Add church <PlusOutlined style={{ fontSize: 14 }} />
        </button>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-[#F1F5F9] bg-white px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            className="!h-10 !rounded-lg !bg-[#E6EDFB] !px-4 !text-sm !font-semibold !text-[#2555A7]"
            onClick={onClose}
            disabled={saving || assignLoading || unassignLoading}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<CheckOutlined />}
            className="!h-10 !rounded-lg !bg-[#2F7AD2] !px-4 !text-sm !font-semibold"
            loading={saving || assignLoading || unassignLoading}
            onClick={handleSubmit}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
