import { renderWithProviders } from '@/test/frontend/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { HierarchyNode } from '@/models/hierarchy'
import type { OrgNodeKind } from '@prisma/client'
import MobileHierarchy, { type MobileHierarchyProps } from './mobile-tree'

const node = (
  id: string,
  kind: OrgNodeKind,
  name: string,
  parentId: string | null,
  children: HierarchyNode[] = [],
  countryCode: string | null = null,
): HierarchyNode => ({ id, kind, name, parentId, countryCode, version: 4, children })

const tree = [
  node('root', 'GLOBAL', 'Global', null, [
    node(
      'ct',
      'COUNTRY',
      'Estonia',
      'root',
      [
        node('dc', 'DIOCESE', 'Dio One', 'ct', [
          node('dn', 'DEANERY', 'Dea', 'dc', [node('ch', 'CHURCH', 'St Mary', 'dn')]),
        ]),
        node('dc2', 'DIOCESE', 'Dio Two', 'ct'),
      ],
      'EE',
    ),
  ]),
]

const setup = (overrides: Partial<MobileHierarchyProps> = {}) => {
  const props: MobileHierarchyProps = {
    nodes: tree,
    canCreate: true,
    canCreateChurch: true,
    canUpdate: true,
    saving: false,
    onCreateChild: vi.fn(),
    onEdit: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  }
  renderWithProviders(<MobileHierarchy {...props} />)
  return props
}

describe('MobileHierarchy', () => {
  it('lists the roots and their children, and hides deeper levels', () => {
    setup()

    expect(screen.getAllByText('Global').length).toBeGreaterThan(0)
    expect(screen.getByText('Estonia')).toBeTruthy()
    // Dio One is one level too deep, so its row is not rendered until expanded.
    expect(screen.queryByText('Dio One')).toBeNull()
    expect(screen.getByLabelText('Expand Estonia')).toBeTruthy()
  })

  it('expands and collapses a branch from the chevron', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByLabelText('Expand Estonia'))
    expect(await screen.findByText('Dio One')).toBeTruthy()
    expect(screen.getByText('Dio Two')).toBeTruthy()

    await user.click(screen.getByLabelText('Collapse Estonia'))
    expect(screen.queryByText('Dio One')).toBeNull()
  })

  it('puts row actions behind the row menu', async () => {
    const user = userEvent.setup()
    const props = setup()

    // The GLOBAL root and a COUNTRY row are fixed, so neither offers an edit.
    await user.click(screen.getByLabelText('Actions for Estonia'))
    expect(await screen.findByRole('menuitem', { name: 'Add diocese' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull()

    const up = screen.getByRole('menuitem', { name: 'Move up' })
    const down = screen.getByRole('menuitem', { name: 'Move down' })
    expect(up.getAttribute('aria-disabled')).toBe('true')
    expect(down.getAttribute('aria-disabled')).toBe('true')

    await user.click(screen.getByRole('menuitem', { name: 'Add diocese' }))
    expect(props.onCreateChild).toHaveBeenCalledWith(expect.objectContaining({ id: 'ct' }))
  })

  it('offers add-church on a deanery row', async () => {
    const user = userEvent.setup()
    const props = setup()

    await user.click(screen.getByLabelText('Expand Estonia'))
    await user.click(await screen.findByLabelText('Expand Dio One'))
    await user.click(await screen.findByLabelText('Expand Dea'))

    await user.click(screen.getByLabelText('Actions for Dea'))
    await user.click(await screen.findByRole('menuitem', { name: 'Add church' }))
    expect(props.onCreateChild).toHaveBeenCalledWith(expect.objectContaining({ id: 'dn' }))
  })

  it('offers nothing to add on a church row', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByLabelText('Expand Estonia'))
    await user.click(await screen.findByLabelText('Expand Dio One'))
    await user.click(await screen.findByLabelText('Expand Dea'))

    await user.click(screen.getByLabelText('Actions for St Mary'))
    expect(await screen.findByRole('menuitem', { name: 'Move church' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /^Add / })).toBeNull()
  })

  it('hides the church add without the church create permission', async () => {
    const user = userEvent.setup()
    setup({ canCreateChurch: false })

    await user.click(screen.getByLabelText('Expand Estonia'))
    await user.click(await screen.findByLabelText('Expand Dio One'))
    await user.click(await screen.findByLabelText('Expand Dea'))
    await user.click(screen.getByLabelText('Actions for Dea'))

    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Add church' })).toBeNull()
  })
})
