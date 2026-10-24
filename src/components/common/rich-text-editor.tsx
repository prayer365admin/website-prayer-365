'use client'

import { richTextToPlainText } from '@/utils/rich-text-plain'
import dynamic from 'next/dynamic'
import { CSSProperties, useEffect, useMemo, useRef } from 'react'

const ReactQuill = dynamic(() => import('./rich-text-quill'), {
  ssr: false,
  loading: () => <div className="min-h-32 animate-pulse bg-neutral-50" />,
})

type RichTextEditorProps = {
  id?: string
  ariaLabel: string
  value?: string | null
  onChange?: (value: string) => void
  placeholder?: string
  minHeight?: number
  disabled?: boolean
}

const formats = ['header', 'bold', 'italic', 'underline', 'color', 'list', 'blockquote']

/** React Quill editor configured for the prayer content formats accepted by the API. */
export default function RichTextEditor({
  id,
  ariaLabel,
  value = '',
  onChange,
  placeholder,
  minHeight = 160,
  disabled = false,
}: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [false, 1, 2, 3] }],
        ['bold', 'italic', 'underline'],
        [{ color: [false, '#2f7ad2'] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'clean'],
      ],
    }),
    [],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const labelEditor = () => {
      const editor = container.querySelector<HTMLElement>('.ql-editor')
      if (editor) {
        editor.setAttribute('aria-label', ariaLabel)
        if (id) editor.id = id
      }
      const toolbar = container.querySelector<HTMLElement>('.ql-toolbar')
      if (toolbar) {
        toolbar.setAttribute('role', 'toolbar')
        toolbar.setAttribute('aria-label', 'Text formatting')
      }
      const labels: Record<string, string> = {
        '.ql-bold': 'Bold',
        '.ql-italic': 'Italic',
        '.ql-underline': 'Underline',
        '.ql-list[value="ordered"]': 'Numbered list',
        '.ql-list[value="bullet"]': 'Bulleted list',
        '.ql-blockquote': 'Quote',
        '.ql-clean': 'Clear formatting',
        '.ql-color': 'Text color',
        '.ql-header': 'Text style',
      }
      for (const [selector, label] of Object.entries(labels)) {
        container.querySelector<HTMLElement>(selector)?.setAttribute('aria-label', label)
      }
    }
    labelEditor()
    const observer = new MutationObserver(labelEditor)
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [ariaLabel, id])

  const style = { '--rte-min-height': `${minHeight}px` } as CSSProperties

  return (
    <div
      className="relative overflow-visible rounded-lg border border-[#d9d9d9] bg-white transition focus-within:border-primary-500 focus-within:shadow-[0_0_0_2px_rgba(47,122,210,0.1)] [&_.ql-container]:rounded-b-lg [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[var(--rte-min-height)] [&_.ql-editor]:text-sm [&_.ql-editor]:leading-6 [&_.ql-editor]:text-neutral-800 [&_.ql-picker.ql-expanded_.ql-picker-label]:border-primary-300 [&_.ql-picker-label.ql-active]:rounded [&_.ql-picker-label.ql-active]:bg-primary-150 [&_.ql-picker-options]:z-50 [&_.ql-picker-options]:rounded-md [&_.ql-picker-options]:border-neutral-200 [&_.ql-picker-options]:shadow-lg [&_.ql-toolbar]:rounded-t-lg [&_.ql-toolbar]:border-0 [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-neutral-200 [&_.ql-toolbar]:bg-neutral-50 [&_.ql-toolbar_button.ql-active]:rounded [&_.ql-toolbar_button.ql-active]:bg-primary-150 [&_.ql-toolbar_button.ql-active]:shadow-[inset_0_0_0_1px_#77b4f2] [&_.ql-toolbar_button.ql-active_.ql-fill]:fill-[#2f7ad2] [&_.ql-toolbar_button.ql-active_.ql-stroke]:stroke-[#2f7ad2] [&_.ql-toolbar_button:hover]:rounded [&_.ql-toolbar_button:hover]:bg-primary-100"
      ref={containerRef}
      style={style}
    >
      <ReactQuill
        formats={formats}
        modules={modules}
        onChange={(html) => onChange?.(richTextToPlainText(html) ? html : '')}
        placeholder={placeholder}
        readOnly={disabled}
        value={value ?? ''}
      />
    </div>
  )
}
