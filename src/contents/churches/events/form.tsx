'use client'

import {
  EventCategorySchema,
  EventCreateInput,
  EventOutput,
  EventUpdateInput,
} from '@/models/event'
import { categoryLabels } from '@/utils/constant'
import {
  churchDateTimeToEventInstant,
  EVENT_EDITOR_DATETIME_FORMAT,
  eventInstantToChurchDateTime,
  eventOffsetLabel,
} from '@/utils/event-datetime'
import { isHttpsLink, normalizeLink } from '@/utils/link'
import { DatePicker, Form, Input, Select, Typography } from 'antd'
import { Dayjs } from 'dayjs'

type EventEditorValues = {
  category: EventCreateInput['category']
  title: string
  description: string
  startsAt: Dayjs
  location: string
  registrationUrl?: string
  languageCode?: string
}

export const EVENT_FORM_ID = 'event-editor-form'

// Separate from the modal so each open mounts a fresh form store seeded from `event`.
export default function EventForm({
  event,
  timezone,
  languageCodes,
  onBusyChange,
  onSubmit,
}: {
  event?: EventOutput
  timezone: string
  languageCodes: string[]
  onBusyChange: (busy: boolean) => void
  onSubmit: (payload: EventCreateInput | EventUpdateInput) => Promise<unknown>
}) {
  const [form] = Form.useForm<EventEditorValues>()
  const startsAt = Form.useWatch('startsAt', form)
  const offset = eventOffsetLabel(startsAt, timezone)
  const initialValues: Partial<EventEditorValues> = event
    ? {
        category: event.category,
        title: event.title,
        description: event.description,
        startsAt: eventInstantToChurchDateTime(event.startsAt, timezone),
        location: event.location,
        registrationUrl: event.registrationUrl ?? undefined,
        languageCode: event.languageCode ?? undefined,
      }
    : { category: 'SERVICE' }

  const submit = async (values: EventEditorValues) => {
    const converted = churchDateTimeToEventInstant(values.startsAt, timezone)
    if (!converted.ok) {
      form.setFields([{ name: 'startsAt', errors: [converted.message] }])
      return
    }

    const base: EventCreateInput = {
      category: values.category,
      title: values.title.trim(),
      description: (values.description ?? '').trim(),
      startsAt: converted.iso,
      location: values.location.trim(),
      registrationUrl: normalizeLink(values.registrationUrl),
      languageCode: values.languageCode || null,
    }
    const payload: EventCreateInput | EventUpdateInput = event
      ? { ...base, version: event.version }
      : base

    onBusyChange(true)
    try {
      await onSubmit(payload)
    } catch {
      // The data hook shows the API error. Keep this mounted so input is preserved.
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <Form
      id={EVENT_FORM_ID}
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={(values) => void submit(values)}
    >
      <Form.Item
        label="Category"
        name="category"
        rules={[{ required: true, message: 'Choose an event category.' }]}
      >
        <Select
          options={EventCategorySchema.options.map((category) => ({
            value: category,
            label: categoryLabels[category],
          }))}
        />
      </Form.Item>

      <Form.Item
        label="Title"
        name="title"
        rules={[
          { required: true, whitespace: true, message: 'Enter an event title.' },
          { max: 300, message: 'Use 300 characters or fewer.' },
        ]}
      >
        <Input maxLength={300} />
      </Form.Item>

      <Form.Item
        label="Description"
        name="description"
        rules={[{ max: 8000, message: 'Use 8000 characters or fewer.' }]}
      >
        <Input.TextArea rows={5} maxLength={8000} showCount />
      </Form.Item>

      <Form.Item
        label="Date and time"
        name="startsAt"
        extra={
          <Typography.Text type="secondary">
            Church timezone: <strong>{timezone}</strong>
            {offset && ` (${offset})`}
          </Typography.Text>
        }
        rules={[{ required: true, message: 'Choose the event date and time.' }]}
      >
        <DatePicker
          className="w-full"
          showTime={{ format: 'HH:mm' }}
          format={EVENT_EDITOR_DATETIME_FORMAT}
        />
      </Form.Item>

      <Form.Item
        label="Location"
        name="location"
        rules={[
          { required: true, whitespace: true, message: 'Enter an event location.' },
          { max: 300, message: 'Use 300 characters or fewer.' },
        ]}
      >
        <Input maxLength={300} />
      </Form.Item>

      <Form.Item
        label="Registration link"
        name="registrationUrl"
        rules={[
          {
            validator: async (_, value?: string) => {
              const link = normalizeLink(value)
              if (link && !isHttpsLink(link)) {
                throw new Error('Enter a valid link, e.g. example.org/register (https only).')
              }
            },
          },
        ]}
      >
        <Input placeholder="example.org/register" />
      </Form.Item>

      <Form.Item label="Language" name="languageCode">
        <Select
          allowClear
          placeholder="No specific language"
          options={languageCodes.map((code) => ({ value: code, label: code }))}
        />
      </Form.Item>
    </Form>
  )
}
