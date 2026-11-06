'use client'

import { AngleDownIcon } from '@/components/icon/angle-down'
import { AngleUpIcon } from '@/components/icon/angle-up'
import { PenIcon } from '@/components/icon/pen'
import { PlusIcon } from '@/components/icon/plus'
import { HIERARCHY_CHILD, HierarchyNode } from '@/models/hierarchy'
import type { OrgNodeKind } from '@prisma/client'
import { KIND_LABEL, KIND_PILL } from './kind'

const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#dde0e4] bg-white p-2 text-sm text-[#737c8c] transition-colors duration-150 enabled:hover:border-[#2f7ad2] enabled:hover:bg-[#e6edfb] enabled:hover:text-[#2f7ad2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7ad2]/40 disabled:cursor-not-allowed disabled:border-[#f6f6f6] disabled:bg-[#f6f6f6] disabled:text-[#dde0e4]'

export interface NodeCardProps {
  node: HierarchyNode
  index: number
  siblingCount: number
  depth: number
  canCreate: boolean
  canCreateChurch: boolean
  canUpdate: boolean
  saving: boolean
  onCreateChild: (node: HierarchyNode) => void
  onEdit: (node: HierarchyNode) => void
  onMove: (node: HierarchyNode, direction: 'up' | 'down') => void
}

/**
 * One node and its subtree for the wide layout (`MobileHierarchy` covers the
 * narrow one). Roots sit flush inside the panel; every deeper level hangs off a
 * branch trunk that each sibling draws for itself, so the connector stops at the
 * last child instead of running past it.
 */
export const NodeCard = ({
  node,
  index,
  siblingCount,
  depth,
  canCreate,
  canCreateChurch,
  canUpdate,
  saving,
  onCreateChild,
  onEdit,
  onMove,
}: NodeCardProps) => {
  const isRoot = depth === 0
  const childKind: OrgNodeKind | null = HIERARCHY_CHILD[node.kind]
  const hasChildren = node.children.length > 0
  const isLast = index === siblingCount - 1
  // A church is created through the church form, which needs its own grant.
  const canAddChild = canCreate && Boolean(childKind) && (childKind !== 'CHURCH' || canCreateChurch)
  // The GLOBAL root is fixed and a COUNTRY's name belongs to the country registry.
  const isEditable = canUpdate && node.kind !== 'GLOBAL' && node.kind !== 'COUNTRY'

  const wrapper = isRoot
    ? 'flex flex-col' + (index > 0 ? ' border-t border-[#dde0e4]' : '')
    : 'relative flex flex-col py-2 pl-6'

  return (
    <div className={wrapper}>
      {!isRoot && (
        <>
          {/* Elbow: the vertical run down to the card's header centre, then across. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-2 top-0 h-[37px] w-4 rounded-bl-[4px] border-b border-l border-[#dde0e4]"
          />
          {/* Trunk: continues to the next sibling; the last one ends at its elbow. */}
          {!isLast && (
            <span
              aria-hidden
              className="pointer-events-none absolute left-2 bottom-0 top-[37px] w-px bg-[#dde0e4]"
            />
          )}
        </>
      )}

      <div
        className={
          isRoot
            ? 'overflow-hidden bg-white'
            : 'overflow-hidden rounded-2xl border border-[#dde0e4] bg-white'
        }
      >
        <div className="flex h-[58px] items-center gap-4 border-b border-[#dde0e4] pl-4">
          <div className="relative flex h-full w-4 flex-none items-center justify-center">
            <span
              className={
                (isRoot
                  ? 'rounded-full bg-[#dde0e4] shadow-[0_0_0_6px_rgba(221,224,228,0.25)]'
                  : 'rounded-full border border-[#dde0e4] bg-white') +
                ' absolute top-1/2 h-4 w-4 -translate-y-1/2'
              }
            />
            {hasChildren && (
              <span className="absolute bottom-0 left-1/2 top-[calc(50%+8px)] w-px -translate-x-1/2 bg-[#dde0e4]" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate font-[family-name:var(--font-text)] text-[16px] font-semibold leading-[150%] text-[#0e203e]">
              {node.name}
            </span>
            <span
              className={`inline-flex items-center whitespace-nowrap rounded-full border px-[10px] py-1 font-[family-name:var(--font-text)] text-xs font-semibold leading-4 ${KIND_PILL[node.kind]}`}
            >
              {KIND_LABEL[node.kind]}
            </span>
            {isEditable && (
              <button
                type="button"
                aria-label={node.kind === 'CHURCH' ? `Move ${node.name}` : `Edit ${node.name}`}
                className={ICON_BUTTON}
                disabled={saving}
                onClick={() => onEdit(node)}
              >
                <PenIcon aria-hidden />
              </button>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 pr-4">
            {canAddChild && childKind && (
              <button
                type="button"
                aria-label={`Add ${KIND_LABEL[childKind]} under ${node.name}`}
                className={ICON_BUTTON}
                disabled={saving}
                onClick={() => onCreateChild(node)}
              >
                <PlusIcon aria-hidden />
              </button>
            )}
            {canUpdate && (
              <>
                <button
                  type="button"
                  aria-label={`Move ${node.name} up`}
                  className={ICON_BUTTON}
                  disabled={saving || index === 0}
                  onClick={() => onMove(node, 'up')}
                >
                  <AngleUpIcon aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${node.name} down`}
                  className={ICON_BUTTON}
                  disabled={saving || isLast}
                  onClick={() => onMove(node, 'down')}
                >
                  <AngleDownIcon aria-hidden />
                </button>
              </>
            )}
          </div>
        </div>

        {hasChildren && (
          <div className="relative flex flex-col bg-[#f6f6f6] px-4">
            {node.children.map((child, childIndex) => (
              <NodeCard
                key={child.id}
                node={child}
                index={childIndex}
                siblingCount={node.children.length}
                depth={depth + 1}
                canCreate={canCreate}
                canCreateChurch={canCreateChurch}
                canUpdate={canUpdate}
                saving={saving}
                onCreateChild={onCreateChild}
                onEdit={onEdit}
                onMove={onMove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default NodeCard
