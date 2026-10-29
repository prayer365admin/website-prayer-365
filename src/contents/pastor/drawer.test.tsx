import { PastorData } from '@/models/pastor'
import { renderWithProviders } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const usePastor = vi.hoisted(() => vi.fn())
const usePastors = vi.hoisted(() => vi.fn())
const useAssignPastorToChurch = vi.hoisted(() => vi.fn())
const useUnassignPastorFromChurch = vi.hoisted(() => vi.fn())
const useCentralChurches = vi.hoisted(() => vi.fn())
const usePastorStaffOptions = vi.hoisted(() => vi.fn())
const useMediaUpload = vi.hoisted(() => vi.fn())

vi.mock('@/hooks/data/central', () => ({
  usePastor,
  usePastors,
  useAssignPastorToChurch,
  useUnassignPastorFromChurch,
  useCentralChurches,
  usePastorStaffOptions,
}))
vi.mock('@/hooks/data/media-upload', () => ({ useMediaUpload }))
vi.mock('@/components/common/pastor-image', () => ({
  default: ({ name }: { name: string }) => <span aria-hidden>{name.charAt(0)}</span>,
}))

import PastorDrawer from './drawer'

const pastor = (overrides: Partial<PastorData> = {}): PastorData => ({
  id: 'pastor-1',
  version: 3,
  name: 'Archdeacon Margaret Holloway',
  introduction: 'Chaplain coordinating diaconal outreach',
  imageAssetId: null,
  imageChurchId: null,
  user_id: null,
  user: null,
  churches: [{ churchId: 'church-1', churchName: 'Grace Church' }],
  ...overrides,
})

const onUpdate = vi.fn().mockResolvedValue({})
const onCreate = vi.fn()
const onAssign = vi.fn().mockResolvedValue({})
const onUnassign = vi.fn().mockResolvedValue({})

beforeEach(() => {
  vi.clearAllMocks()
  usePastors.mockReturnValue({ onCreate, onUpdate })
  useAssignPastorToChurch.mockReturnValue({ onAssign, loading: false })
  useUnassignPastorFromChurch.mockReturnValue({ onUnassign, loading: false })
  useCentralChurches.mockReturnValue({
    data: [
      { id: 'church-1', name: 'Grace Church', status: 'APPROVED' },
      { id: 'church-2', name: 'Viimsi Püha Jaakobi kirik', status: 'APPROVED' },
    ],
    isLoading: false,
  })
  usePastorStaffOptions.mockReturnValue({ data: [], isLoading: false })
  useMediaUpload.mockReturnValue({ onUpload: vi.fn(), loading: false })
})

describe('PastorDrawer', () => {
  it('saves an edit with the loaded version and unchanged assignments', async () => {
    const onClose = vi.fn()
    usePastor.mockReturnValue({ data: pastor(), loading: false, error: null })

    renderWithProviders(<PastorDrawer pastorId="pastor-1" onClose={onClose} />)

    expect(screen.getByRole('heading', { name: 'Edit Pastor' })).toBeTruthy()
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('Archdeacon Margaret Holloway')

    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Hieromonk Daniel Carter')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate).toHaveBeenCalledWith({
      pastorId: 'pastor-1',
      payload: {
        version: 3,
        name: 'Hieromonk Daniel Carter',
        introduction: 'Chaplain coordinating diaconal outreach',
        imageAssetId: null,
        userId: null,
      },
    })
    expect(onAssign).toHaveBeenCalledWith({
      churchId: 'church-1',
      assigned: { pastorId: 'pastor-1' },
    })
    expect(onUnassign).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('unassigns a church removed from the drawer before saving', async () => {
    const onClose = vi.fn()
    usePastor.mockReturnValue({ data: pastor(), loading: false, error: null })

    renderWithProviders(<PastorDrawer pastorId="pastor-1" onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: 'Remove church assignment' }))
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(onUnassign).toHaveBeenCalledWith({
        churchId: 'church-1',
        pastorId: 'pastor-1',
      }),
    )
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.objectContaining({ version: 3 }) }),
    )
  })

  it('lets a new pastor pick a photo and explains the church requirement on save', async () => {
    const onClose = vi.fn()
    const onUpload = vi.fn().mockResolvedValue({ assetId: 'asset-9' })
    useMediaUpload.mockReturnValue({ onUpload, loading: false })
    usePastor.mockReturnValue({ data: undefined, loading: false, error: null })

    const { container } = renderWithProviders(<PastorDrawer onClose={onClose} />)

    // Change Photo must be usable before a church is assigned.
    const changePhoto = screen.getByRole('button', { name: /change photo/i })
    expect((changePhoto as HTMLButtonElement).disabled).toBe(false)

    const fileInput = container.ownerDocument.querySelector(
      '.ant-drawer input[type="file"]',
    ) as HTMLInputElement | null
    expect(fileInput).not.toBeNull()
    await userEvent.upload(
      fileInput as HTMLInputElement,
      new File(['x'], 'photo.png', {
        type: 'image/png',
      }),
    )

    await userEvent.type(screen.getByLabelText('Name'), 'Pastor With Photo')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    // The upload API needs a church for ownership, so saving explains instead of failing silently.
    await waitFor(() =>
      expect(screen.getByText('Add a church before saving the profile photo.')).toBeTruthy(),
    )
    expect(onCreate).not.toHaveBeenCalled()
    expect(onUpload).not.toHaveBeenCalled()
  })

  it('uploads a replaced photo during an edit save', async () => {
    const onClose = vi.fn()
    const onUpload = vi.fn().mockResolvedValue({ assetId: 'asset-9' })
    useMediaUpload.mockReturnValue({ onUpload, loading: false })
    usePastor.mockReturnValue({ data: pastor(), loading: false, error: null })

    const { container } = renderWithProviders(
      <PastorDrawer pastorId="pastor-1" onClose={onClose} />,
    )

    const fileInput = container.ownerDocument.querySelector(
      '.ant-drawer input[type="file"]',
    ) as HTMLInputElement | null
    const file = new File(['x'], 'photo.png', { type: 'image/png' })
    await userEvent.upload(fileInput as HTMLInputElement, file)

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file))
    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith({
        pastorId: 'pastor-1',
        payload: {
          version: 3,
          name: 'Archdeacon Margaret Holloway',
          introduction: 'Chaplain coordinating diaconal outreach',
          imageAssetId: 'asset-9',
          userId: null,
        },
      }),
    )
  })

  it('creates a pastor then assigns the chosen church', async () => {
    const onClose = vi.fn()
    usePastor.mockReturnValue({ data: undefined, loading: false, error: null })
    onCreate.mockResolvedValue({ data: { result: { id: 'pastor-new' } } })

    renderWithProviders(<PastorDrawer onClose={onClose} />)

    expect(screen.getByRole('heading', { name: 'New Pastor' })).toBeTruthy()
    await userEvent.type(screen.getByLabelText('Name'), 'Pastor Daniel Carter')
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'Pastor Daniel Carter',
      introduction: null,
      userId: null,
    })
    expect(onAssign).not.toHaveBeenCalled()
    // No image picked, so the version-1 profile patch is skipped.
    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })
})
