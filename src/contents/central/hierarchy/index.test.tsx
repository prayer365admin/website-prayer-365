import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useHierarchy = vi.hoisted(() => vi.fn())
const useCountries = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/data/central', () => ({ useHierarchy, useCountries }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    createAny: () => ({ granted: true }),
    updateAny: () => ({ granted: true }),
  }),
}))
vi.mock('@/components/common/dashboard/main-header', () => ({
  default: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
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

  beforeEach(() => {
    vi.clearAllMocks()
    useHierarchy.mockReturnValue({
      data: tree,
      loading: false,
      saving: false,
      error: null,
      onCreate: vi.fn(),
      onUpdate,
    })
    useCountries.mockReturnValue({ data: [] })
  })

  it('offers only valid parents and confirms before moving a node', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByText('Dea'))
    await user.click(screen.getByRole('button', { name: 'Rename or move' }))

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

  it('lets a church be moved but not renamed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByText('St Mary'))
    expect(screen.queryByRole('button', { name: 'Rename or move' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Move church' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('textbox').hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText('Rename a church from its church profile.')).toBeTruthy()
  })

  it('renames without a move confirmation', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentsCentralHierarchy />)

    await user.click(screen.getByText('Dio Two'))
    await user.click(screen.getByRole('button', { name: 'Rename or move' }))
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
})
