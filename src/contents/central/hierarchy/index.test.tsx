import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useHierarchy = vi.hoisted(() => vi.fn())
const useCountries = vi.hoisted(() => vi.fn())
const grants = vi.hoisted(() => ({ churchCreate: true }))
const viewport = vi.hoisted(() => ({ isMobile: false }))
vi.mock('@/hooks/data/central', () => ({ useHierarchy, useCountries }))
vi.mock('@/hooks/ui/screen-size', () => ({
  default: () => ({ width: 1440, height: 900, isMobile: viewport.isMobile, isTablet: false }),
}))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    createAny: (subject: string) => ({
      granted: subject !== 'prayer_church' || grants.churchCreate,
    }),
    createOwn: () => ({ granted: false }),
    updateAny: () => ({ granted: true }),
  }),
}))
vi.mock('@/contents/central/churches/drawer', () => ({
  default: ({ defaultParentId }: { defaultParentId?: string }) => (
    <div>church drawer for {defaultParentId}</div>
  ),
}))

import ContentsCentralHierarchy from './index'

const node = (
  id: string,
  kind: string,
  name: string,
  parentId: string | null,
  children: unknown[] = [],
  countryCode: string | null = null,
) => ({ id, kind, name, parentId, countryCode, version: 4, children })

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

describe('ContentsCentralHierarchy', () => {
  const onUpdate = vi.fn()
  const onCreate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    grants.churchCreate = true
    viewport.isMobile = false
    useHierarchy.mockReturnValue({
      data: tree,
      loading: false,
      saving: false,
      error: null,
      onCreate,
      onUpdate,
    })
    useCountries.mockReturnValue({ data: [] })
  })

  it('renders every node as a card with its kind pill', () => {
    renderWithProviders(<ContentsCentralHierarchy />)

    for (const [name, kind] of [
      ['Global', 'Global'],
      ['Estonia', 'Country'],
      ['Dio One', 'Diocese'],
      ['Dea', 'Deanery'],
      ['St Mary', 'Church'],
    ]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
      expect(screen.getAllByText(kind).length).toBeGreaterThan(0)
    }
  })

  it('switches to the accordion list on narrow screens', () => {
    viewport.isMobile = true
    renderWithProviders(<ContentsCentralHierarchy />)

    // The root opens by default, so its country row is visible and collapsible.
    expect(screen.getByLabelText('Expand Estonia')).toBeTruthy()
    // Deeper rows stay collapsed until asked for.
    expect(screen.queryByText('Dio One')).toBeNull()
  })

  it('renames without a move confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByLabelText('Edit Dio Two'))
    const dialog = await screen.findByRole('dialog')
    const name = within(dialog).getByRole('textbox')
    await user.clear(name)
    await user.type(name, 'Dio Renamed')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        nodeId: 'dc2',
        payload: { version: 4, name: 'Dio Renamed' },
      }),
    )
    expect(screen.queryByText('Confirm move')).toBeNull()
  })

  it('offers only valid parents and confirms before moving a node', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByLabelText('Edit Dea'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getAllByRole('combobox')[0])
    await screen.findByTitle('Dio Two (Diocese)')
    const labels = Array.from(document.querySelectorAll('.ant-select-item-option')).map(
      (o) => o.textContent,
    )
    expect(labels).toEqual(expect.arrayContaining(['Dio One (Diocese)', 'Dio Two (Diocese)']))
    expect(labels.some((l) => l?.includes('Country') || l?.includes('Church'))).toBe(false)

    await user.click(screen.getByTitle('Dio Two (Diocese)'))
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Confirm move')).toBeTruthy()
    expect(screen.getByText('1 church will move with it.')).toBeTruthy()
    expect(onUpdate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Move node' }))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        nodeId: 'dn',
        payload: { version: 4, parentId: 'dc2' },
      }),
    )
  })

  it('shows no edit control on the root and country rows', () => {
    renderWithProviders(<ContentsCentralHierarchy />)

    expect(screen.queryByLabelText('Edit Global')).toBeNull()
    expect(screen.queryByLabelText('Edit Estonia')).toBeNull()
    expect(screen.getByLabelText('Edit Dio One')).toBeTruthy()
  })

  it('lets a church be moved but not renamed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    expect(screen.queryByLabelText('Edit St Mary')).toBeNull()
    await user.click(screen.getByLabelText('Move St Mary'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox').hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText('Rename a church from its church profile.')).toBeTruthy()
  })

  it('opens the create drawer from a row and creates the next kind down', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByLabelText('Add Diocese under Estonia'))
    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('Diocese')).toBeTruthy()
    expect(within(drawer).getByText('Estonia')).toBeTruthy()

    await user.type(within(drawer).getByRole('textbox'), 'Tartu Diocese')
    await user.click(within(drawer).getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(onCreate).toHaveBeenCalledWith({
        kind: 'DIOCESE',
        name: 'Tartu Diocese',
        parentId: 'ct',
      }),
    )
  })

  it('opens the church form under a deanery and stops at the church row', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    expect(screen.queryByLabelText('Add Diocese under Dea')).toBeNull()
    expect(screen.queryByLabelText(/Add .* under St Mary/)).toBeNull()

    await user.click(screen.getByLabelText('Add Church under Dea'))
    expect(await screen.findByText('church drawer for dn')).toBeTruthy()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('hides the church add button without the church create permission', () => {
    grants.churchCreate = false
    renderWithProviders(<ContentsCentralHierarchy />)

    expect(screen.queryByLabelText('Add Church under Dea')).toBeNull()
    expect(screen.getByLabelText('Add Diocese under Estonia')).toBeTruthy()
  })

  it('disables the arrows at the ends of a sibling list', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    expect(screen.getByLabelText('Move Dio One up').hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('Move Dio Two down').hasAttribute('disabled')).toBe(true)

    await user.click(screen.getByLabelText('Move Dio One down'))

    expect(onUpdate).toHaveBeenCalledWith({
      nodeId: 'dc',
      payload: { version: 4, move: 'down' },
    })
  })
})
