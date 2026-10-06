'use client'

import { AnnouncementInput, AnnouncementOutput } from '@/models/announcement'
import { Form, Input } from 'antd'

type AnnouncementEditorValues = {
  title: string
  body: string
}

export const ANNOUNCEMENT_FORM_ID = 'announcement-editor-form'

export default function AnnouncementForm({
  announcement,
  onBusyChange,
  onSubmit,
}: {
  announcement?: AnnouncementOutput
  onBusyChange: (busy: boolean) => void
  onSubmit: (payload: AnnouncementInput) => Promise<unknown>
}) {
  const [form] = Form.useForm<AnnouncementEditorValues>()

  const submit = async (values: AnnouncementEditorValues) => {
    const payload: AnnouncementInput = {
      title: values.title.trim(),
      body: values.body.trim(),
      ...(announcement ? { version: announcement.version } : {}),
    }

    onBusyChange(true)
    try {
      await onSubmit(payload)
    } catch {
      // The data hook reports the API error. Keep the form mounted for retry.
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <Form
      id={ANNOUNCEMENT_FORM_ID}
      form={form}
      layout="vertical"
      initialValues={
        announcement ? { title: announcement.title, body: announcement.body } : undefined
      }
      onFinish={(values) => void submit(values)}
    >
      <AnnouncementFields />
    </Form>
  )
}

/** Title and message inputs with the API's limits; reused by the central detail page. */
export const AnnouncementFields = () => (
  <>
    <Form.Item
      label="Title"
      name="title"
      rules={[
        { required: true, whitespace: true, message: 'Enter an announcement title.' },
        { max: 500, message: 'Use 500 characters or fewer.' },
      ]}
    >
      <Input maxLength={500} />
    </Form.Item>

    <Form.Item
      label="Message"
      name="body"
      rules={[
        { required: true, whitespace: true, message: 'Enter an announcement message.' },
        { max: 10000, message: 'Use 10000 characters or fewer.' },
      ]}
    >
      <Input.TextArea rows={8} maxLength={10000} showCount />
    </Form.Item>
  </>
)
