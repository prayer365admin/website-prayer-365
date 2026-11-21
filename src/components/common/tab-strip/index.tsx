'use client'

import { useRef } from 'react'

export type TabStripItem<T extends string> = { key: T; label: string }

/*
 * Segmented view switcher for the console (plan 043, T7).
 *
 * It looks like the design's pill strip and behaves like the antd `Tabs` it replaced: one tab in
 * the tab order, arrow keys move the selection, and `aria-selected` tells a screen reader which
 * view is showing. Styling stays on the theme tokens, so no screen re-invents the colours.
 */
export const TabStrip = <T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly TabStripItem<T>[]
  value: T
  onChange: (next: T) => void
  label: string
}) => {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})

  const move = (direction: 1 | -1) => {
    const index = items.findIndex((item) => item.key === value)
    const next = items[(index + direction + items.length) % items.length]
    onChange(next.key)
    refs.current[next.key]?.focus()
  }

  return (
    <div
      className="flex w-fit gap-1 rounded-xl bg-primary-150 p-1"
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.key}
          ref={(node) => {
            refs.current[item.key] = node
          }}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          tabIndex={item.key === value ? 0 : -1}
          onClick={() => onChange(item.key)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault()
              move(1)
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault()
              move(-1)
            }
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            item.key === value
              ? 'bg-white text-[var(--color-primary-900)]'
              : 'text-[var(--color-primary-650)]'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
