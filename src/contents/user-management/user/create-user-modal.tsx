'use client'

import PasswordInput from '@/components/common/password-input'
import UploadBox from '@/components/common/upload-box'
import { useHierarchy, useRoleAssignments } from '@/hooks/data/central'
import { useRoles } from '@/hooks/data/role'
import { useUsers } from '@/hooks/data/user'
import { HierarchyNode } from '@/models/hierarchy'
import { CheckOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import { Drawer, Form, Input, Select, Typography } from 'antd'
import { useMemo, useState } from 'react'
import s from './edit-user-modal.module.scss'
import { flattenHierarchy } from './hierarchy'
import { PermittedModules } from './permitted-modules'

const { Title } = Typography

export interface CreateUserModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

interface CreateUserFormValues {
  email: string
  name: string
  role_id?: string
  password?: string | null
  confirm_password?: string | null
}

const fieldLabel =
  '[&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!font-semibold [&_.ant-form-item-label>label]:!text-[#393E46]'

export default function CreateUserModal({ open, onClose, onSaved }: CreateUserModalProps) {
  const [form] = Form.useForm<CreateUserFormValues>()
  const { onCreate } = useUsers({ queryString: '', enableFetch: false })
  const { data: roles } = useRoles({ queryString: '', enableFetch: open })
  const { data: tree } = useHierarchy(open)
  const { onCreate: onCreateAssignment } = useRoleAssignments({ enableFetch: false })

  const [provinceId, setProvinceId] = useState<string | undefined>(undefined)
  const [dioceseId, setDioceseId] = useState<string | undefined>(undefined)
  /*
   * Media assets are church-scoped (`media_assets.church_id` is NOT NULL and
   * `POST /api/v1/uploads` requires a churchId), and a staff account has no
   * church context. The picker therefore previews locally (`deferUpload`) and
   * nothing is sent until a user-avatar media scope exists.
   */
  const [upload, setUpload] = useState<{ url: string | null }>({ url: null })
  const [saving, setSaving] = useState(false)

  const roleId = Form.useWatch('role_id', form)
  const selectedRole = useMemo(() => roles?.find((r) => r.id === roleId), [roles, roleId])
  const currentPermissions = useMemo(() => selectedRole?.permission ?? [], [selectedRole])

  const flatNodes = useMemo(() => flattenHierarchy(tree ?? []), [tree])
  const countries = useMemo(() => flatNodes.filter((n) => n.kind === 'COUNTRY'), [flatNodes])
  const dioceses = useMemo(() => {
    const allDioceses = flatNodes.filter((n: HierarchyNode) => n.kind === 'DIOCESE')
    if (!provinceId) return allDioceses
    return allDioceses.filter((d) => d.parentId === provinceId)
  }, [flatNodes, provinceId])

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

  const resetDraft = () => {
    form.resetFields()
    setProvinceId(undefined)
    setDioceseId(undefined)
    setUpload({ url: null })
  }

  const handleSubmit = async () => {
    let values: CreateUserFormValues
    try {
      values = await form.validateFields()
    } catch {
      return // antd already rendered the per-field messages
    }
    setSaving(true)
    try {
      const created = await onCreate({
        email: values.email,
        name: values.name,
        password: values.password as string,
        ...(values.role_id ? { role_id: values.role_id } : {}),
      })

      const userId = created?.data?.result?.id
      // Jurisdiction only exists as a role assignment, so it needs the new user id.
      if (userId && selectedRole && provinceId && dioceseId) {
        await onCreateAssignment({
          userId,
          roleKey: selectedRole.name,
          orgNodeId: dioceseId,
        })
      }

      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="right"
      size={576}
      closable={false}
      destroyOnHidden
      mask={{ closable: true }}
      aria-label="Create staff member"
      rootClassName={s.drawer}
      afterOpenChange={(isOpen) => {
        if (!isOpen) resetDraft()
      }}
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
      <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-[#EEF2F7] flex-shrink-0">
        <div>
          <Title level={5} className="!text-[16px] !font-semibold !text-[#0E203E] !mb-0.5">
            Create Staff Member
          </Title>
          <span className="text-xs text-[#8F96A3]">
            C.C. new staff account and grant canonical access
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
        <Form form={form} layout="vertical" className={fieldLabel}>
          <UploadBox
            formName="profile_picture"
            label="Profile Picture"
            upload={upload}
            setUpload={setUpload}
            width="120px"
            height="120px"
            deferUpload
          />

          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input the name!' }]}
          >
            <Input placeholder="Pastor Daniel Carter" className="!h-10 !rounded-lg !text-sm" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input the email!' },
              { type: 'email', message: 'Please input a valid email!' },
            ]}
          >
            <Input
              type="email"
              placeholder="d.carter@gracecommunity.org.uk"
              className="!h-10 !rounded-lg !text-sm"
            />
          </Form.Item>

          <Form.Item
            name="role_id"
            label="Supported Canonical Role"
            rules={[{ required: true, message: 'Please select a role!' }]}
          >
            <Select
              placeholder="Supported Canonical Role"
              options={roleOptions}
              className="w-full [&_.ant-select-selector]:!h-10 [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-[#DDE0E4] [&_.ant-select-selection-item]:!leading-[40px]"
            />
          </Form.Item>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#393E46]">Jurisdictional Boundary</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#5C6370]">Province / Region</span>
                <Select
                  id="create-user-province"
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
                  id="create-user-diocese"
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

          <div className="mt-3">
            <PermittedModules permissions={currentPermissions} />
          </div>

          <div className="mt-3">
            <PasswordInput label="Password" required />
          </div>
        </Form>
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
          onClick={handleSubmit}
          disabled={saving}
          className="h-10 px-4 rounded-lg bg-[#2F7AD2] text-white font-semibold text-sm flex items-center gap-2 hover:bg-[#2555A7] transition-colors cursor-pointer disabled:opacity-50"
        >
          {saving ? (
            <LoadingOutlined className="text-sm" />
          ) : (
            <>
              <span>Create Staff Member</span>
              <CheckOutlined className="text-sm" />
            </>
          )}
        </button>
      </div>
    </Drawer>
  )
}
