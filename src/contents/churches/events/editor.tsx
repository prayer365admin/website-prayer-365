'use client'

import { EventCreateInput, EventOutput, EventUpdateInput } from '@/models/event'
import { Modal } from 'antd'
import { useState } from 'react'
import EventForm, { EVENT_FORM_ID } from './form'

export default function EventEditor({
  open,
  event,
  loading,
  onCancel,
  afterClose,
  ...formProps
}: {
  open: boolean
  event?: EventOutput
  timezone: string
  languageCodes: string[]
  loading: boolean
  onCancel: () => void
  afterClose: () => void
  onSubmit: (payload: EventCreateInput | EventUpdateInput) => Promise<unknown>
}) {
  const [submitting, setSubmitting] = useState(false)
  const busy = loading || submitting

  return (
    <Modal
      open={open}
      destroyOnHidden
      afterClose={afterClose}
      title={event ? 'Edit event' : 'Create event'}
      okText={event ? 'Save changes' : 'Create event'}
      confirmLoading={busy}
      okButtonProps={{ htmlType: 'submit', form: EVENT_FORM_ID, disabled: busy }}
      cancelButtonProps={{ disabled: busy }}
      closable={!busy}
      mask={{ closable: !busy }}
      onCancel={onCancel}
      width={720}
      centered
    >
      <EventForm
        key={event?.id ?? 'new'}
        event={event}
        onBusyChange={setSubmitting}
        {...formProps}
      />
    </Modal>
  )
}
