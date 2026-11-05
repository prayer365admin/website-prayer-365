'use client'

import CentralChurchDrawer from '@/contents/central/churches/drawer'
import { useCountries, useHierarchy } from '@/hooks/data/central'
import { useAccessPermission } from '@/hooks/data/access-permission'
import useScreenSize from '@/hooks/ui/screen-size'
import { HIERARCHY_CHILD, HIERARCHY_PARENT, HierarchyNode, NodeCreate } from '@/models/hierarchy'
import type { OrgNodeKind } from '@prisma/client'
import { Alert, Button, Drawer, Form, Input, Modal, Select, Spin } from 'antd'
import { useMemo, useState } from 'react'
import { KIND_LABEL } from './kind'
import MobileHierarchy from './mobile-tree'
import NodeCard from './node-card'

type FlatNode = Omit<HierarchyNode, 'children'>

const flatten = (nodes: HierarchyNode[], out: FlatNode[] = []): FlatNode[] => {
  for (const { children, ...node } of nodes) {
    out.push(node)
    flatten(children, out)
  }
  return out
}

const subtree = (node: HierarchyNode): HierarchyNode[] => [node, ...node.children.flatMap(subtree)]

const EDIT_FORM_ID = 'central-hierarchy-edit'

type EditValues = { name: string; parentId: string | null }
type PendingMove = EditValues & { node: HierarchyNode }

export default function ContentsCentralHierarchy() {
  const { data, loading, saving, error, onCreate, onUpdate } = useHierarchy()
  const { data: countries } = useCountries()
  const permission = useAccessPermission()
  const { isMobile } = useScreenSize()
  const canCreate = permission.createAny('prayer_hierarchy').granted
  const canUpdate = permission.updateAny('prayer_hierarchy').granted
  // A deanery's add button opens the church form, so it needs the church grant.
  const canCreateChurch =
    permission.createAny('prayer_church').granted || permission.createOwn('prayer_church').granted

  const [createParent, setCreateParent] = useState<HierarchyNode>()
  const [createRoot, setCreateRoot] = useState(false)
  const [createChurchUnder, setCreateChurchUnder] = useState<HierarchyNode>()
  const [editNode, setEditNode] = useState<HierarchyNode>()
  const [pendingMove, setPendingMove] = useState<PendingMove>()
  const [createForm] = Form.useForm<NodeCreate>()
  const [editForm] = Form.useForm<EditValues>()

  const tree = useMemo(() => data ?? [], [data])
  const flat = useMemo(() => flatten(tree), [tree])

  // A church's name lives on its church record; the hierarchy only places it.
  const isChurch = editNode?.kind === 'CHURCH'
  const editLabel = isChurch ? 'Move church' : 'Rename or move'

  const createKind: OrgNodeKind | undefined = createRoot
    ? 'GLOBAL'
    : createParent
      ? (HIERARCHY_CHILD[createParent.kind] ?? undefined)
      : undefined

  const parentOptions = (kind: OrgNodeKind | undefined, exclude = new Set<string>()) => {
    const parentKind = kind ? HIERARCHY_PARENT[kind] : null
    return flat
      .filter((n) => parentKind && n.kind === parentKind && !exclude.has(n.id))
      .map((n) => ({
        label: `${n.name} (${KIND_LABEL[n.kind]})`,
        value: n.id,
        disabled: false,
      }))
  }

  const usedCountries = new Set(flat.map((n) => n.countryCode).filter(Boolean))
  const countryOptions = (countries ?? [])
    .filter((c) => c.enabled && !usedCountries.has(c.code))
    .map((c) => ({ label: `${c.name} (${c.code})`, value: c.code }))

  const openCreate = (parent?: HierarchyNode) => {
    // A church only exists with its Church record, so its row opens the church form.
    if (parent && HIERARCHY_CHILD[parent.kind] === 'CHURCH') {
      setCreateChurchUnder(parent)
      return
    }
    createForm.resetFields()
    setCreateRoot(!parent)
    setCreateParent(parent)
  }

  const closeCreate = () => {
    setCreateRoot(false)
    setCreateParent(undefined)
  }

  const submitCreate = async (values: NodeCreate) => {
    if (!createKind) return
    await onCreate({
      kind: createKind,
      name: values.name,
      parentId: createKind === 'GLOBAL' ? null : (createParent?.id ?? null),
      ...(createKind === 'COUNTRY' ? { countryCode: values.countryCode } : {}),
    })
    createForm.resetFields()
    closeCreate()
  }

  const save = async ({ node, name, parentId }: PendingMove) => {
    await onUpdate({
      nodeId: node.id,
      payload: {
        version: node.version,
        ...(name !== node.name ? { name } : {}),
        ...(parentId !== node.parentId ? { parentId } : {}),
      },
    })
    setPendingMove(undefined)
    setEditNode(undefined)
  }

  const submitEdit = async (values: EditValues) => {
    if (!editNode) return
    const parentId = values.parentId ?? editNode.parentId
    if (values.name === editNode.name && parentId === editNode.parentId) {
      setEditNode(undefined)
      return
    }
    // Moving changes descendant reporting scope: always confirm first (DESIGN S21).
    if (parentId !== editNode.parentId) {
      setPendingMove({ node: editNode, name: values.name, parentId })
      return
    }
    await save({ node: editNode, name: values.name, parentId })
  }

  const openEdit = (node: HierarchyNode) => setEditNode(node)

  const onMove = (node: HierarchyNode, direction: 'up' | 'down') => {
    void onUpdate({ nodeId: node.id, payload: { version: node.version, move: direction } })
  }

  const nameOf = (id: string | null) => flat.find((n) => n.id === id)?.name ?? '—'

  /**
   * The current parent may not be a legal target (legacy node placed at the
   * wrong level). Keep it visible but not selectable instead of rendering an id.
   */
  const editParentOptions = (node: HierarchyNode) => {
    const options = parentOptions(node.kind, new Set(subtree(node).map((n) => n.id)))
    if (node.parentId && !options.some((option) => option.value === node.parentId)) {
      options.unshift({
        label: `${nameOf(node.parentId)} (current)`,
        value: node.parentId,
        disabled: true,
      })
    }
    return options
  }
  const affectedChurches = pendingMove
    ? subtree(pendingMove.node).filter((n) => n.kind === 'CHURCH').length
    : 0

  const createParentName = createRoot ? 'None (root)' : (createParent?.name ?? '—')

  return (
    <section className="flex w-full min-w-0 flex-1 min-h-0 flex-col font-[family-name:var(--font-text)]">
      <header className="flex flex-col gap-1 pb-3 sm:pb-4">
        <h1 className="m-0 font-[family-name:var(--font-heading)] text-2xl font-semibold leading-none tracking-[-1px] text-[#0e203e]">
          Organization Structure
        </h1>
        <p className="m-0 text-sm font-normal leading-[150%] text-[#5c6370]">
          Arrange countries, dioceses, deaneries and churches in the agreed hierarchy.
        </p>
      </header>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Hierarchy could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <div className="flex min-h-0 flex-none rounded-2xl bg-white p-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:flex-1 sm:p-4">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-0 border-[#dde0e4] bg-white sm:border">
          {loading ? (
            <div className="flex flex-1 items-center justify-center p-12">
              <Spin />
            </div>
          ) : tree.length ? (
            isMobile ? (
              <MobileHierarchy
                nodes={tree}
                canCreate={canCreate}
                canCreateChurch={canCreateChurch}
                canUpdate={canUpdate}
                saving={saving}
                onCreateChild={openCreate}
                onEdit={openEdit}
                onMove={onMove}
              />
            ) : (
              tree.map((node, index) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  index={index}
                  siblingCount={tree.length}
                  depth={0}
                  canCreate={canCreate}
                  canCreateChurch={canCreateChurch}
                  canUpdate={canUpdate}
                  saving={saving}
                  onCreateChild={openCreate}
                  onEdit={openEdit}
                  onMove={onMove}
                />
              ))
            )
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-sm leading-[150%] text-[#5c6370]">
              <span>No hierarchy yet</span>
              {canCreate && (
                <Button type="primary" onClick={() => openCreate()}>
                  Create root node
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Drawer
        title="New node"
        open={Boolean(createKind)}
        onClose={closeCreate}
        destroyOnHidden
        extra={
          <Button type="primary" loading={saving} onClick={() => createForm.submit()}>
            Create
          </Button>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={submitCreate}>
          <Form.Item label="Type">
            <span className="text-sm text-[#0e203e]">
              {createKind ? KIND_LABEL[createKind] : '—'}
            </span>
          </Form.Item>
          <Form.Item label="Parent">
            <span className="text-sm text-[#0e203e]">{createParentName}</span>
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          {createKind === 'COUNTRY' && (
            <Form.Item
              name="countryCode"
              label="Country"
              rules={[{ required: true }]}
              extra="Only enabled countries without a node are listed."
            >
              <Select showSearch optionFilterProp="label" options={countryOptions} />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      <Drawer
        title={editLabel}
        open={Boolean(editNode)}
        onClose={() => setEditNode(undefined)}
        destroyOnHidden
        size={480}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button onClick={() => setEditNode(undefined)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              form={EDIT_FORM_ID}
              loading={saving && !pendingMove}
            >
              Save
            </Button>
          </div>
        }
      >
        {editNode && (
          <Form
            key={editNode.id}
            id={EDIT_FORM_ID}
            form={editForm}
            layout="vertical"
            initialValues={{ name: editNode.name, parentId: editNode.parentId }}
            onFinish={submitEdit}
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, whitespace: true }]}
              extra={isChurch ? 'Rename a church from its church profile.' : undefined}
            >
              <Input maxLength={200} disabled={isChurch} />
            </Form.Item>
            {editNode.kind !== 'GLOBAL' && (
              <Form.Item name="parentId" label="Parent" rules={[{ required: true }]}>
                <Select showSearch optionFilterProp="label" options={editParentOptions(editNode)} />
              </Form.Item>
            )}
          </Form>
        )}
      </Drawer>

      <Modal
        title="Confirm move"
        open={Boolean(pendingMove)}
        onCancel={() => setPendingMove(undefined)}
        onOk={() => pendingMove && save(pendingMove)}
        okText="Move node"
        confirmLoading={saving}
      >
        {pendingMove && (
          <>
            <p>
              Move <strong>{pendingMove.node.name}</strong> from{' '}
              <strong>{nameOf(pendingMove.node.parentId)}</strong> to{' '}
              <strong>{nameOf(pendingMove.parentId)}</strong>?
            </p>
            <p>
              {affectedChurches} church{affectedChurches === 1 ? '' : 'es'} will move with it.
            </p>
            <Alert
              type="info"
              showIcon
              message="Reports use the current hierarchy"
              description="Regional totals, including past periods, follow the new placement. Access to private requests is not granted by moving a node."
            />
          </>
        )}
      </Modal>

      {createChurchUnder && (
        <CentralChurchDrawer
          defaultParentId={createChurchUnder.id}
          onClose={() => setCreateChurchUnder(undefined)}
        />
      )}
    </section>
  )
}
