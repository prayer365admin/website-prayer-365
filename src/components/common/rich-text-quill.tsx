'use client'

import ReactQuill from 'react-quill-new'
import 'react-quill-new/dist/quill.snow.css'

export type RichTextQuillProps = {
  formats: string[]
  modules: Record<string, unknown>
  onChange: (html: string) => void
  placeholder?: string
  readOnly: boolean
  value: string
}

export default function RichTextQuill(props: RichTextQuillProps) {
  return <ReactQuill theme="snow" {...props} />
}
