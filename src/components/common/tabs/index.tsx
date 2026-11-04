'use client'

import { Tabs as AntTabs } from 'antd'
import type { TabsProps } from 'antd'
import { LayoutGroup, motion } from 'framer-motion'
import { ReactNode, useId, useMemo, useState } from 'react'
import styles from './index.module.scss'

type CommonTabsProps = Omit<
  TabsProps,
  'activeKey' | 'animated' | 'classNames' | 'defaultActiveKey' | 'items' | 'onChange' | 'styles'
> & {
  activeKey?: string
  animateContent?: boolean
  defaultActiveKey?: string
  items: NonNullable<TabsProps['items']>
  onChange?: (activeKey: string) => void
  padding?: number | string
}

function PillLabel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'block',
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      {active && (
        <motion.span
          aria-hidden
          layoutId="active-pill"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            background: '#fff',
          }}
          transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
        />
      )}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          color: active ? 'var(--color-primary-900, #0e203e)' : 'var(--color-primary-700, #1758a6)',
          transition: 'color 200ms ease',
        }}
      >
        {children}
      </span>
    </span>
  )
}

export default function Tabs({
  activeKey,
  animateContent = true,
  defaultActiveKey,
  items,
  onChange,
  padding = 16,
  ...tabsProps
}: CommonTabsProps) {
  const layoutGroupId = useId()
  const firstKey = items[0]?.key ? String(items[0].key) : ''
  const [internalActiveKey, setInternalActiveKey] = useState(defaultActiveKey ?? firstKey)
  const selectedKey = activeKey ?? internalActiveKey

  const pillItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        label: <PillLabel active={String(item.key) === selectedKey}>{item.label}</PillLabel>,
      })),
    [items, selectedKey],
  )

  const handleChange = (nextKey: string) => {
    if (activeKey === undefined) setInternalActiveKey(nextKey)
    onChange?.(nextKey)
  }

  return (
    <LayoutGroup id={layoutGroupId}>
      <AntTabs
        {...tabsProps}
        activeKey={selectedKey}
        animated={{ inkBar: false, tabPane: animateContent }}
        classNames={{ header: styles.header }}
        items={pillItems}
        onChange={handleChange}
        styles={{
          root: {
            boxSizing: 'border-box',
            padding,
          },
          header: {
            minHeight: 40,
            margin: '0 0 16px',
            padding: 4,
            borderRadius: 12,
            background: 'var(--color-primary-150, #e6edfb)',
          },
          item: {
            margin: 0,
            padding: 0,
          },
          indicator: {
            display: 'none',
          },
        }}
      />
    </LayoutGroup>
  )
}
