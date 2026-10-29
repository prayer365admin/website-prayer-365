'use client'

import { usePurgeCentralChurch } from '@/hooks/data/central'
import { Alert, Input, Modal, Typography } from 'antd'
import axios from 'axios'
import { useState } from 'react'

/** Server counts arrive as `fields` on the 409; these are their readable names. */
const DEPENDENT_LABELS: Record<string, string> = {
  prayers: 'prayers',
  events: 'events',
  announcements: 'announcements',
  requests: 'requests',
  serviceTimes: 'service times',
  churchPastors: 'assigned pastors',
  voiceProfiles: 'voice profiles',
  mediaAssets: 'media items',
  galleryItems: 'gallery items',
  donations: 'donations',
  donationSubscriptions: 'recurring donations',
  checkIns: 'check-ins',
  analyticsEvents: 'activity records',
  userChurches: 'linked app users',
  roleAssignments: 'role assignments',
}

export type PurgeTarget = { id: string; name: string; version: number }

/**
 * The only hard delete for a church. The typed name is required because the
 * action is irreversible; the API refuses anything that is not PENDING or that
 * still has related records, and that refusal is shown here with its counts.
 *
 * The dialog is mounted only while a target is selected, so its input state
 * resets on every open without an effect.
 */
export default function PurgeChurchModal({
  church,
  onClose,
}: {
  church?: PurgeTarget
  onClose: () => void
}) {
  if (!church) return null
  return <PurgeChurchDialog key={church.id} church={church} onClose={onClose} />
}

function PurgeChurchDialog({ church, onClose }: { church: PurgeTarget; onClose: () => void }) {
  const { onPurge, loading } = usePurgeCentralChurch()
  const [typed, setTyped] = useState('')
  const [blockers, setBlockers] = useState<string>()

  const confirm = async () => {
    try {
      await onPurge({
        churchId: church.id,
        payload: { version: church.version, confirmName: typed },
      })
      onClose()
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error_code === 'CHURCH_HAS_CONTENT') {
        const fields = (error.response.data.fields ?? {}) as Record<string, string>
        setBlockers(
          Object.entries(fields)
            .map(([key, count]) => `${count} ${DEPENDENT_LABELS[key] ?? key}`)
            .join(', '),
        )
        return
      }
      // Everything else (stale version, wrong status, denied) is reported by the hook.
      onClose()
    }
  }

  return (
    <Modal
      open
      title="Delete church"
      okText="Delete church"
      okButtonProps={{ danger: true, disabled: typed.trim() !== church.name.trim() }}
      confirmLoading={loading}
      onOk={confirm}
      onCancel={onClose}
    >
      <Alert
        type="warning"
        showIcon
        className="mb-4"
        message="This cannot be undone"
        description="Only a church that has never been approved and holds no content can be deleted. Use Archive for any other church."
      />
      <Typography.Paragraph>
        Type <Typography.Text strong>{church.name}</Typography.Text> to confirm.
      </Typography.Paragraph>
      <Input
        value={typed}
        placeholder={church.name}
        onChange={(event) => setTyped(event.target.value)}
      />
      {blockers && (
        <Alert
          type="error"
          showIcon
          className="mt-4"
          message="This church still has records"
          description={`It holds ${blockers}, so it cannot be deleted. Archive it instead.`}
        />
      )}
    </Modal>
  )
}
