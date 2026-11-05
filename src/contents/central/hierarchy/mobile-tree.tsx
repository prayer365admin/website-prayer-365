'use client'

import { AngleRightIcon } from '@/components/icon/angle-right'
import { EllipsisVIcon } from '@/components/icon/ellipsis-v'
import { HIERARCHY_CHILD, HierarchyNode } from '@/models/hierarchy'
import type { OrgNodeKind } from '@prisma/client'
import { Dropdown, type MenuProps } from 'antd'
import { useMemo, useState } from 'react'
import { KIND_LABEL, KIND_PILL } from './kind'

/** One indent step; the tree is drawn with white space rather than lines. */
const INDENT = 16

export interface MobileNodeProps {
  node: HierarchyNode
  depth: number
  index: number
  siblingCount: number
  expanded: Set<string>
  onToggle: (nodeId: string) => void
  canCreate: boolean
  canCreateChurch: boolean
  canUpdate: boolean
  saving: boolean
  onCreateChild: (node: HierarchyNode) => void
  onEdit: (node: HierarchyNode) => void
  onMove: (node: HierarchyNode, direction: 'up' | 'down') => void
}

/**
 * One list row plus its children. Actions live behind a per-row menu so the row
 * itself stays a single line with room for the name.
 */
const MobileRow = ({
  node,
  depth,
  index,
  siblingCount,
  expanded,
  onToggle,
  canCreate,
  canCreateChurch,
  canUpdate,
  saving,
  onCreateChild,
  onEdit,
  onMove,
}: MobileNodeProps) => {
  const childKind: OrgNodeKind | null = HIERARCHY_CHILD[node.kind]
  const canAddChild = canCreate && Boolean(childKind) && (childKind !== 'CHURCH' || canCreateChurch)
  // The GLOBAL root is fixed and a COUNTRY's name belongs to the country registry.
  const isEditable = canUpdate && node.kind !== 'GLOBAL' && node.kind !== 'COUNTRY'
  const hasChildren = node.children.length > 0
  const open = hasChildren && expanded.has(node.id)
  const isLast = index === siblingCount - 1

  const items: MenuProps['items'] = [
    ...(canAddChild && childKind
      ? [{ key: 'add', label: `Add ${KIND_LABEL[childKind].toLowerCase()}` }]
      : []),
    ...(isEditable
      ? [{ key: 'edit', label: node.kind === 'CHURCH' ? 'Move church' : 'Edit' }]
      : []),
    ...(canUpdate
      ? [
          { key: 'up', label: 'Move up', disabled: saving || index === 0 },
          { key: 'down', label: 'Move down', disabled: saving || isLast },
        ]
      : []),
  ]

  const onSelect: MenuProps['onClick'] = ({ key }) => {
    if (key === 'add') onCreateChild(node)
    if (key === 'edit') onEdit(node)
    if (key === 'up') onMove(node, 'up')
    if (key === 'down') onMove(node, 'down')
  }

  return (
    <>
      <div
        className="flex min-h-[48px] items-center gap-1.5 py-1.5 pr-1"
        style={{ paddingLeft: 8 + depth * INDENT }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name}`}
            className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-md text-[10px] text-[#737c8c] active:bg-[#f1f5f9]"
            onClick={() => onToggle(node.id)}
          >
            <AngleRightIcon
              aria-hidden
              className={'transition-transform duration-150 ' + (open ? 'rotate-90' : 'rotate-0')}
            />
          </button>
        ) : (
          <span className="h-6 w-6 flex-none" aria-hidden />
        )}

        <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-text)] text-sm font-semibold leading-[150%] text-[#0e203e]">
          {node.name}
        </span>

        <span
          className={`inline-flex flex-none items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-[family-name:var(--font-text)] text-[10px] font-semibold leading-4 ${KIND_PILL[node.kind]}`}
        >
          {KIND_LABEL[node.kind]}
        </span>

        {items.length > 0 && (
          <Dropdown menu={{ items, onClick: onSelect }} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              aria-label={`Actions for ${node.name}`}
              className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-sm text-[#737c8c] active:bg-[#f1f5f9]"
            >
              <EllipsisVIcon aria-hidden />
            </button>
          </Dropdown>
        )}
      </div>

      {open &&
        node.children.map((child, childIndex) => (
          <MobileRow
            key={child.id}
            node={child}
            depth={depth + 1}
            index={childIndex}
            siblingCount={node.children.length}
            expanded={expanded}
            onToggle={onToggle}
            canCreate={canCreate}
            canCreateChurch={canCreateChurch}
            canUpdate={canUpdate}
            saving={saving}
            onCreateChild={onCreateChild}
            onEdit={onEdit}
            onMove={onMove}
          />
        ))}
    </>
  )
}

export interface MobileHierarchyProps extends Omit<
  MobileNodeProps,
  'node' | 'depth' | 'index' | 'siblingCount' | 'expanded' | 'onToggle'
> {
  nodes: HierarchyNode[]
}

/**
 * Narrow screens: one grouped list. Only the roots are open to begin with, and
 * every row is a single line whose actions sit behind a menu.
 */
export const MobileHierarchy = ({ nodes, ...handlers }: MobileHierarchyProps) => {
  // Derived default: until a chevron is touched, only the roots are open.
  const defaultOpen = useMemo(() => new Set(nodes.map((root) => root.id)), [nodes])
  const [toggled, setToggled] = useState<Set<string> | null>(null)
  const expanded = toggled ?? defaultOpen

  const toggle = (nodeId: string) => {
    setToggled((current) => {
      const next = new Set<string>(current ?? defaultOpen)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  return (
    <div className="p-2">
      <div className="divide-y divide-[#eef1f4] overflow-hidden rounded-2xl border border-[#dde0e4] bg-white">
        {nodes.map((node, index) => (
          <MobileRow
            key={node.id}
            node={node}
            depth={0}
            index={index}
            siblingCount={nodes.length}
            expanded={expanded}
            onToggle={toggle}
            {...handlers}
          />
        ))}
      </div>
    </div>
  )
}

export default MobileHierarchy
