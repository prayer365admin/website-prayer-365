'use client'

import DashboardMainHeader from '@/components/common/dashboard/main-header'
import { useAccessPermission } from '@/hooks/data/access-permission'
import { useCountries, useHierarchy } from '@/hooks/data/central'
import { HIERARCHY_PARENT, HierarchyNode, NodeCreate } from '@/models/hierarchy'
import type { OrgNodeKind } from '@prisma/client'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tree,
} from 'antd'
import { useMemo, useState } from 'react'

const KIND_LABEL: Record<OrgNodeKind, string> = {
  GLOBAL: 'Global',
  COUNTRY: 'Country',
  DIOCESE: 'Diocese',
  DEANERY: 'Deanery',
  CHURCH: 'Church',
}

/** Churches are created with their node from Central Churches, never here. */
const CREATABLE_KINDS: OrgNodeKind[] = ['GLOBAL', 'COUNTRY', 'DIOCESE', 'DEANERY']

type FlatNode = Omit<HierarchyNode, 'children'>

const flatten = (nodes: HierarchyNode[], out: FlatNode[] = []): FlatNode[] => {
  for (const { children, ...node } of nodes) {
    out.push(node)
    flatten(children, out)
  }
  return out
}

const findNode = (nodes: HierarchyNode[], id: string): HierarchyNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node
    const hit = findNode(node.children, id)
    if (hit) return hit
  }
}

const subtree = (node: HierarchyNode): HierarchyNode[] => [node, ...node.children.flatMap(subtree)]

type EditValues = { name: string; parentId: string | null }
type PendingMove = EditValues & { node: HierarchyNode }

export default function ContentsCentralHierarchy() {
  const { data, loading, saving, error, onCreate, onUpdate } = useHierarchy()
  const { data: countries } = useCountries()
  const permission = useAccessPermission()
  const canCreate = permission.createAny('prayer_hierarchy').granted
  const canUpdate = permission.updateAny('prayer_hierarchy').granted

  const [selectedId, setSelectedId] = useState<string>()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<PendingMove>()
  const [createForm] = Form.useForm<NodeCreate>()
  const [editForm] = Form.useForm<EditValues>()
  const createKind = Form.useWatch('kind', createForm)

  const tree = useMemo(() => data ?? [], [data])
  const flat = useMemo(() => flatten(tree), [tree])
  const selected = selectedId ? findNode(tree, selectedId) : undefined
  // A church's name lives on its church record; the hierarchy only places it.
  const isChurch = selected?.kind === 'CHURCH'
  const editLabel = isChurch ? 'Move church' : 'Rename or move'

  const parentOptions = (kind: OrgNodeKind | undefined, exclude = new Set<string>()) => {
    const parentKind = kind ? HIERARCHY_PARENT[kind] : null
    return flat
      .filter((n) => parentKind && n.kind === parentKind && !exclude.has(n.id))
      .map((n) => ({ label: `${n.name} (${KIND_LABEL[n.kind]})`, value: n.id }))
  }

  const usedCountries = new Set(flat.map((n) => n.countryCode).filter(Boolean))
  const countryOptions = (countries ?? [])
    .filter((c) => c.enabled && !usedCountries.has(c.code))
    .map((c) => ({ label: `${c.name} (${c.code})`, value: c.code }))

  const kindOptions = CREATABLE_KINDS.filter((k) => k !== 'GLOBAL' || flat.length === 0).map(
    (k) => ({ label: KIND_LABEL[k], value: k }),
  )

  const submitCreate = async (values: NodeCreate) => {
    await onCreate({
      kind: values.kind,
      name: values.name,
      parentId: values.kind === 'GLOBAL' ? null : values.parentId,
      ...(values.kind === 'COUNTRY' ? { countryCode: values.countryCode } : {}),
    })
    createForm.resetFields()
    setCreateOpen(false)
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
    setEditOpen(false)
  }

  const submitEdit = async (values: EditValues) => {
    if (!selected) return
    const parentId = values.parentId ?? selected.parentId
    if (values.name === selected.name && parentId === selected.parentId) {
      setEditOpen(false)
      return
    }
    // Moving changes descendant reporting scope: always confirm first (DESIGN S21).
    if (parentId !== selected.parentId) {
      setPendingMove({ node: selected, name: values.name, parentId })
      return
    }
    await save({ node: selected, name: values.name, parentId })
  }

  const openEdit = () => {
    if (!selected) return
    editForm.setFieldsValue({ name: selected.name, parentId: selected.parentId })
    setEditOpen(true)
  }

  const nameOf = (id: string | null) => flat.find((n) => n.id === id)?.name ?? '—'
  const affectedChurches = pendingMove
    ? subtree(pendingMove.node).filter((n) => n.kind === 'CHURCH').length
    : 0

  const toTreeData = (nodes: HierarchyNode[]): Array<Record<string, unknown>> =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <Space size={4}>
          <span>{n.name}</span>
          <Tag>{KIND_LABEL[n.kind]}</Tag>
          {n.countryCode && <Tag color="blue">{n.countryCode}</Tag>}
        </Space>
      ),
      children: toTreeData(n.children),
    }))

  return (
    <>
      <DashboardMainHeader
        title="Organization Structure"
        description="Arrange countries, dioceses, deaneries and churches in the agreed hierarchy."
      >
        {canCreate && (
          <Col>
            <Button type="primary" size="large" onClick={() => setCreateOpen(true)}>
              New Node
            </Button>
          </Col>
        )}
      </DashboardMainHeader>

      {error && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Hierarchy could not be loaded"
          description="Refresh the page or try again shortly."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card loading={loading}>
            {tree.length ? (
              <Tree
                defaultExpandAll
                showLine
                treeData={toTreeData(tree)}
                selectedKeys={selectedId ? [selectedId] : []}
                onSelect={(keys) => setSelectedId(keys[0] as string | undefined)}
              />
            ) : (
              <Empty description="No hierarchy yet" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Selected node">
            {selected ? (
              <>
                <Descriptions
                  column={1}
                  size="small"
                  items={[
                    { key: 'name', label: 'Name', children: selected.name },
                    { key: 'kind', label: 'Kind', children: KIND_LABEL[selected.kind] },
                    { key: 'parent', label: 'Parent', children: nameOf(selected.parentId) },
                    ...(selected.countryCode
                      ? [{ key: 'country', label: 'Country', children: selected.countryCode }]
                      : []),
                  ]}
                />
                {canUpdate && (
                  <Button className="mt-4" onClick={openEdit}>
                    {editLabel}
                  </Button>
                )}
              </>
            ) : (
              <Empty description="Select a node" />
            )}
          </Card>
        </Col>
      </Row>

      <Drawer
        title="New node"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        destroyOnHidden
        extra={
          <Button type="primary" loading={saving} onClick={() => createForm.submit()}>
            Create
          </Button>
        }
      >
        <Form form={createForm} layout="vertical" onFinish={submitCreate}>
          <Form.Item name="kind" label="Type" rules={[{ required: true }]}>
            <Select
              options={kindOptions}
              onChange={() => createForm.setFieldsValue({ parentId: undefined })}
            />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={200} />
          </Form.Item>
          {createKind && createKind !== 'GLOBAL' && (
            <Form.Item
              name="parentId"
              label={`Parent ${KIND_LABEL[HIERARCHY_PARENT[createKind]!].toLowerCase()}`}
              rules={[{ required: true }]}
            >
              <Select showSearch optionFilterProp="label" options={parentOptions(createKind)} />
            </Form.Item>
          )}
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

      <Modal
        title={editLabel}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => editForm.submit()}
        okText="Save"
        confirmLoading={saving && !pendingMove}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, whitespace: true }]}
            extra={isChurch ? 'Rename a church from its church profile.' : undefined}
          >
            <Input maxLength={200} disabled={isChurch} />
          </Form.Item>
          {selected && selected.kind !== 'GLOBAL' && (
            <Form.Item name="parentId" label="Parent" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                options={parentOptions(selected.kind, new Set(subtree(selected).map((n) => n.id)))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

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
    </>
  )
}
