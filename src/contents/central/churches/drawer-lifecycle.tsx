'use client'

import { useAccessPermission } from '@/hooks/data/access-permission'
import type { ChurchLifecycleAction } from '@/hooks/data/central'
import type { ChurchDetail } from '@/models/central-church'
import { CheckOutlined, ExclamationCircleFilled, FolderOpenOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useState } from 'react'
import { confirmLifecycle } from './lifecycle'
import PurgeChurchModal from './purge-modal'

export interface DrawerLifecycleProps {
  church: ChurchDetail
  onLifecycle: (params: { action: ChurchLifecycleAction; version: number }) => Promise<unknown>
  showSave?: boolean
  submitting?: boolean
}

export default function DrawerLifecycle({
  church,
  onLifecycle,
  showSave = false,
  submitting = false,
}: DrawerLifecycleProps) {
  const { modal } = App.useApp()
  const [saving, setSaving] = useState(false)
  const [purgeOpen, setPurgeOpen] = useState(false)

  const permission = useAccessPermission()
  const canLifecycle =
    permission.updateAny('prayer_church_lifecycle').granted ||
    permission.updateOwn('prayer_church_lifecycle').granted
  const canDelete =
    permission.deleteAny('prayer_church').granted || permission.deleteOwn('prayer_church').granted

  const runLifecycle = (action: ChurchLifecycleAction) => {
    confirmLifecycle(modal, church, action, async (params) => {
      setSaving(true)
      try {
        await onLifecycle(params)
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <>
      <div className="px-6 py-4 border-t border-neutral-200 flex flex-col gap-3 bg-white shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canLifecycle && (
              <>
                {church.status === 'APPROVED' && (
                  <Button
                    className="bg-[#e6edfb] text-[#2555a7] text-sm font-semibold border-none rounded-lg h-10 px-4 hover:!bg-[#d7e4fa] hover:!text-[#1d4486]"
                    disabled={saving}
                    onClick={() => runLifecycle('suspend')}
                  >
                    Suspend
                  </Button>
                )}
                {church.status === 'SUSPENDED' && (
                  <Button
                    className="bg-[#e6edfb] text-[#2555a7] text-sm font-semibold border-none rounded-lg h-10 px-4 hover:!bg-[#d7e4fa] hover:!text-[#1d4486]"
                    disabled={saving}
                    onClick={() => runLifecycle('unsuspend')}
                  >
                    Unsuspend
                  </Button>
                )}
                {church.status === 'PENDING' && (
                  <Button disabled={saving} onClick={() => runLifecycle('approve')}>
                    Approve
                  </Button>
                )}
              </>
            )}
            {canDelete && church.status === 'PENDING' && (
              <Button danger disabled={saving} onClick={() => setPurgeOpen(true)}>
                Delete church
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {canLifecycle && church.status !== 'ARCHIVED' && (
              <Button
                aria-label="Archive"
                className="bg-white text-primary-500 border border-primary-500 text-sm font-semibold rounded-lg h-10 px-4 inline-flex items-center gap-1.5 hover:!text-primary-700 hover:!border-primary-700"
                icon={<FolderOpenOutlined />}
                disabled={saving || submitting}
                onClick={() => runLifecycle('archive')}
              >
                Archive
              </Button>
            )}
            {showSave && (
              <Button
                aria-label="Save setup"
                type="primary"
                htmlType="submit"
                loading={submitting || saving}
                className="h-10 rounded-lg px-4 text-sm font-semibold inline-flex items-center gap-1.5"
                icon={<CheckOutlined />}
              >
                Save setup
              </Button>
            )}
          </div>
        </div>

        {(church.status === 'APPROVED' || church.status === 'SUSPENDED') && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f9f9fa] text-[#2555a7] text-xs font-normal leading-relaxed">
            <ExclamationCircleFilled className="text-sm text-[#2555a7] shrink-0" />
            <span>
              {church.approvedAt
                ? `Approved on ${new Date(church.approvedAt).toLocaleString()}.`
                : ''}{' '}
              Archiving removes the church from public access while preserving all records.
            </span>
          </div>
        )}
      </div>

      <PurgeChurchModal
        church={
          purgeOpen ? { id: church.id, name: church.name, version: church.version } : undefined
        }
        onClose={() => setPurgeOpen(false)}
      />
    </>
  )
}
