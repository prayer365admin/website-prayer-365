'use client'

import RichTextEditor from '@/components/common/rich-text-editor'
import { Form } from 'antd'

/**
 * Rich-text prayer body shared by the create drawer and the editor. The API
 * sanitises on write and rejects an empty plain text, so the required rule
 * mirrors that (a whitespace-only HTML body is not a body).
 */
export default function GeneralPrayerBodyField() {
  return (
    <Form.Item
      label="Prayer text"
      name="body"
      rules={[
        { required: true, message: 'Prayer text is required.' },
        {
          validator: async (_rule, value: string | undefined) => {
            const text = (value ?? '').replace(/<[^>]*>/g, ' ').trim()
            if (text.length === 0) throw new Error('Prayer text is required.')
          },
        },
      ]}
      validateTrigger="onSubmit"
    >
      <RichTextEditor
        ariaLabel="Prayer text"
        minHeight={280}
        placeholder="Write the full prayer text"
      />
    </Form.Item>
  )
}
