'use client'

import { useHierarchy, useRoleAssignments } from '@/hooks/data/central'
import { useMediaUpload } from '@/hooks/data/media-upload'
import { useRoles } from '@/hooks/data/role'
import { useUser } from '@/hooks/data/user'
import { HierarchyNode } from '@/models/hierarchy'
import { RoleDataModel } from '@/models/role'
import { RoleAssignmentSummary } from '@/models/role-assignment'
import { UserDataModel, UserPayloadUpdateModel } from '@/models/user'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Drawer, Input, Select, Skeleton, Typography, Upload } from 'antd'
import { useMemo, useState } from 'react'
import s from './edit-user-modal.module.scss'
import { flattenHierarchy } from './hierarchy'
import { PermittedModules } from './permitted-modules'

const { Title } = Typography

export interface EditUserModalProps {
  open: boolean
  userId: string | null
  onClose: () => void
  onSaved: () => void
}

interface EditUserFormProps {
  user: UserDataModel
  roles: RoleDataModel[] | undefined
  assignments: RoleAssignmentSummary[] | undefined
  tree: HierarchyNode[] | undefined
  onUpdate: (payload: UserPayloadUpdateModel) => Promise<unknown>
  onCreateAssignment: (payload: {
    userId: string
    roleKey: string
    orgNodeId: string
  }) => Promise<unknown>
  onClose: () => void
  onSaved: () => void
}

function EditUserForm({
  user,
  roles,
  assignments,
  tree,
  onUpdate,
  onCreateAssignment,
  onClose,
  onSaved,
}: EditUserFormProps) {
  const flatNodes = useMemo(() => flattenHierarchy(tree ?? []), [tree])
  const assignedNode = useMemo(
    () => flatNodes.find((n) => n.id === assignments?.[0]?.org_node_id),
    [flatNodes, assignments],
  )
  const initialProvinceId =
    assignedNode?.kind === 'COUNTRY'
      ? assignedNode.id
      : assignedNode?.kind === 'DIOCESE'
        ? (assignedNode.parentId ?? undefined)
        : undefined
  const initialDioceseId = assignedNode?.kind === 'DIOCESE' ? assignedNode.id : undefined

  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email ?? '')
  const [roleId, setRoleId] = useState<string | undefined>(
    user.role_id ?? user.role?.id ?? undefined,
  )
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    user.avatarUrl ?? user.profile_picture ?? null,
  )
  const [photoAssetId, setPhotoAssetId] = useState<string | null>(user.profile_asset_id ?? null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [photoChanged, setPhotoChanged] = useState(false)
  const { onUpload: onUploadAvatar } = useMediaUpload({ purpose: 'USER_AVATAR' })
  const [provinceId, setProvinceId] = useState<string | undefined>(initialProvinceId)
  const [dioceseId, setDioceseId] = useState<string | undefined>(initialDioceseId)
  const [saving, setSaving] = useState(false)

  const countries = useMemo(() => flatNodes.filter((n) => n.kind === 'COUNTRY'), [flatNodes])
  const dioceses = useMemo(() => {
    const allDioceses = flatNodes.filter((n) => n.kind === 'DIOCESE')
    if (!provinceId) return allDioceses
    return allDioceses.filter((d) => d.parentId === provinceId)
  }, [flatNodes, provinceId])

  const selectedRole = useMemo(() => roles?.find((r) => r.id === roleId), [roles, roleId])
  const currentPermissions = useMemo(() => selectedRole?.permission ?? [], [selectedRole])

  const roleOptions = useMemo(
    () => (roles ?? []).map((r) => ({ label: r.name, value: r.id })),
    [roles],
  )

  const provinceOptions = useMemo(
    () => countries.map((c) => ({ label: c.name, value: c.id })),
    [countries],
  )

  const dioceseOptions = useMemo(
    () => dioceses.map((d) => ({ label: d.name, value: d.id })),
    [dioceses],
  )

  const handlePhotoUpload = async (file: File) => {
    const result = await onUploadAvatar(file)
    if (result) {
      setPhotoUrl(result.url)
      setPhotoAssetId(result.assetId)
      setPhotoRemoved(false)
      setPhotoChanged(true)
    }
    return false
  }

  const handleRemovePhoto = () => {
    setPhotoUrl(null)
    setPhotoAssetId(null)
    setPhotoRemoved(true)
    setPhotoChanged(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: UserPayloadUpdateModel = {
        name,
        email,
        role_id: roleId,
      }
      if (photoChanged) {
        payload.profile_asset_id = photoRemoved ? null : photoAssetId
      }
      await onUpdate(payload)

      if (provinceId && dioceseId) {
        const currentAssignment = assignments?.[0]
        const currentOrgId = currentAssignment?.org_node_id
        if (currentOrgId !== dioceseId && currentOrgId !== provinceId) {
          const roleKey = selectedRole?.name ?? 'prayer_church_admin'
          await onCreateAssignment({ userId: user.id, roleKey, orgNodeId: dioceseId })
        }
      }

      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const initial = name?.[0]?.toUpperCase() ?? 'U'

  return (
    <>
      <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[#EEF2F7] flex-shrink-0">
        <div>
          <Title level={5} className="!text-[16px] !font-semibold !text-[#0E203E] !mb-0.5">
            Edit Scoped Role
          </Title>
          <span className="text-xs text-[#8F96A3]">
            Manage jurisdiction and canonical access rights
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-lg border border-[#DDE0E4] bg-white flex items-center justify-center text-[#5C6370] hover:text-[#0E203E] hover:border-[#B0B6BF] transition-colors cursor-pointer"
        >
          <CloseOutlined className="text-sm" />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto px-6 py-3 flex flex-col gap-3 ${s.bodyScroll}`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-user-name" className="text-sm font-semibold text-[#393E46]">
            Name
          </label>
          <Input
            id="edit-user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pastor Daniel Carter"
            className="!h-10 !rounded-lg !border-[#DDE0E4] !text-sm text-[#0E203E]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-user-email" className="text-sm font-semibold text-[#393E46]">
            Email
          </label>
          <Input
            id="edit-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="d.carter@gracecommunity.org.uk"
            className="!h-10 !rounded-lg !border-[#DDE0E4] !text-sm text-[#0E203E]"
          />
        </div>

        <div className="flex gap-4 rounded-xl border border-[#EEF2F7] bg-[#FAFBFE] p-3 items-center">
          <Avatar
            src={photoUrl ?? undefined}
            size={100}
            shape="square"
            className="rounded-xl flex-shrink-0 !w-[100px] !h-[100px] !leading-[100px] !text-3xl object-cover border border-[#EEF2F7]"
          >
            {initial}
          </Avatar>
          <div className="flex flex-col justify-between gap-3 flex-1">
            <p className="text-xs text-[#393E46] !m-0 leading-relaxed">
              Your profile picture and sacramental affiliation name are visible to prayer group
              leaders, fellowship coordinators, and pastoral clergy.
            </p>
            <div className="flex items-center gap-2">
              <Upload showUploadList={false} beforeUpload={handlePhotoUpload} accept="image/*">
                <Button
                  type="primary"
                  size="small"
                  icon={<UploadOutlined />}
                  className="!bg-[#2F7AD2] !h-8 !px-3 !rounded-lg !text-xs !font-semibold flex items-center gap-1.5 shadow-none"
                >
                  Change Photo
                </Button>
              </Upload>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleRemovePhoto}
                className="!h-8 !px-3 !rounded-lg !border-[#2F7AD2] !text-[#2F7AD2] !bg-white !text-xs !font-semibold flex items-center gap-1.5 hover:!bg-[#F5F7FF]"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-user-role" className="text-sm font-semibold text-[#393E46]">
            Supported Canonical Role
          </label>
          <Select
            id="edit-user-role"
            className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
            value={roleId}
            onChange={(val) => setRoleId(val)}
            options={roleOptions}
            placeholder="Supported Canonical Role"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[#393E46]">Jurisdictional Boundary</label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#5C6370]">Province / Region</span>
              <Select
                id="edit-user-province"
                allowClear
                placeholder="United Kingdom"
                value={provinceId}
                onChange={(val) => {
                  setProvinceId(val)
                  setDioceseId(undefined)
                }}
                options={provinceOptions}
                className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#5C6370]">Diocese</span>
              <Select
                id="edit-user-diocese"
                allowClear
                placeholder="Diocese of London"
                value={dioceseId}
                onChange={(val) => setDioceseId(val)}
                options={dioceseOptions}
                className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
              />
            </div>
          </div>
        </div>

        <PermittedModules permissions={currentPermissions} />
      </div>

      <div className="flex justify-between items-center px-6 py-3 border-t border-[#EEF2F7] bg-white flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-4 rounded-lg bg-[#E6EDFB] text-[#2555A7] font-semibold text-sm hover:bg-[#D5E3F9] transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-4 rounded-lg bg-[#2F7AD2] text-white font-semibold text-sm flex items-center gap-2 hover:bg-[#2555A7] transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <LoadingOutlined className="text-sm" />
          ) : (
            <>
              <span>Save Changes</span>
              <CheckOutlined className="text-sm" />
            </>
          )}
        </button>
      </div>
    </>
  )
}

export default function EditUserModal({ open, userId, onClose, onSaved }: EditUserModalProps) {
  const { data: userData, loading: userLoading, onUpdate } = useUser(userId ?? '')
  const { data: roles } = useRoles({ queryString: '', enableFetch: open })
  const { data: assignments, onCreate: onCreateAssignment } = useRoleAssignments({
    userId: userId ?? undefined,
    enableFetch: open && Boolean(userId),
  })
  const { data: tree } = useHierarchy(open && Boolean(userId))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={576}
      closable={false}
      destroyOnHidden
      mask={{ closable: true }}
      aria-label="Edit scoped role"
      rootClassName={s.drawer}
      styles={{
        wrapper: {
          boxSizing: 'border-box',
        },
        section: {
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(14, 32, 62, 0.15)',
          height: 'calc(100vh - 3rem)',
          maxHeight: 880,
          margin: 'auto 0',
        },
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        },
      }}
    >
      {userLoading || !userData ? (
        <div className="p-6">
          <Skeleton active />
        </div>
      ) : (
        <EditUserForm
          key={userData.id}
          user={userData}
          roles={roles}
          assignments={assignments}
          tree={tree}
          onUpdate={onUpdate}
          onCreateAssignment={onCreateAssignment}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Drawer>
  )
}
