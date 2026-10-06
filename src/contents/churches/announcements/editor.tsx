'use client'

import { AnnouncementInput, AnnouncementOutput } from '@/models/announcement'
import { Alert, Modal } from 'antd'
import { useState } from 'react'
import AnnouncementForm, { ANNOUNCEMENT_FORM_ID } from './form'

export default function AnnouncementEditor({
  open,
  announcement,
  loading,
  onCancel,
  afterClose,
  onSubmit,
}: {
  open: boolean
  announcement?: AnnouncementOutput
  loading: boolean
  onCancel: () => void
  afterClose: () => void
  onSubmit: (payload: AnnouncementInput) => Promise<unknown>
}) {
  const [submitting, setSubmitting] = useState(false)
  const busy = loading || submitting

  return (
    <Modal
      open={open}
      destroyOnHidden
      afterClose={afterClose}
      title={announcement ? 'Edit announcement' : 'Create announcement'}
      okText={announcement ? 'Save changes' : 'Create draft'}
      confirmLoading={busy}
      okButtonProps={{ htmlType: 'submit', form: ANNOUNCEMENT_FORM_ID, disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onCancel={onCancel}
      width={720}
      centered
    >
      {!announcement && (
        <Alert
          className="!mb-4"
          type="info"
          showIcon
          message="This creates a draft"
          description="You can review it in the list before publishing it immediately to the mobile app."
        />
      )}
      {announcement?.publishedAt && (
        <Alert
          className="!mb-4"
          type="warning"
          showIcon
          message="Editing returns this announcement to Draft"
          description="Saving takes it off the mobile app so the change can be reviewed. Publish it again when it is ready."
        />
      )}
      <AnnouncementForm
        key={announcement?.id ?? 'new'}
        announcement={announcement}
        onBusyChange={setSubmitting}
        onSubmit={onSubmit}
      />
    </Modal>
  )
}
