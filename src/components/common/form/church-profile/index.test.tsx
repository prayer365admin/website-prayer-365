import { renderWithProviders, axiosMock } from '@/test/frontend/render'
import { ChurchProfileOutput } from '@/models/church'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

const access = vi.hoisted(() => ({ canEdit: true }))
vi.mock('@/hooks/data/access-permission', () => ({
  useAccessPermission: () => ({
    updateAny: () => ({ granted: access.canEdit }),
    updateOwn: () => ({ granted: false }),
  }),
}))

vi.mock('@/components/common/google-map', () => ({
  GoogleMapPicker: ({
    onChange,
  }: {
    onChange: (v: { latitude: number; longitude: number } | null) => void
  }) => (
    <div data-testid="gm-picker" className="bg-[#ECEEF0]">
      <button type="button" onClick={() => onChange({ latitude: 59.4, longitude: 24.7 })}>
        Find address
      </button>
      <button type="button" onClick={() => onChange(null)}>
        Clear marker
      </button>
    </div>
  ),
}))

import FormChurchProfileTabs from './index'

const profile = {
  id: 'c1',
  name: 'Grace',
  denomination: 'Lutheran',
  description: 'Demo church for testing.',
  address: {
    line1: 'Test Str 1',
    line2: null,
    city: 'Tallinn',
    postalCode: null,
    countryCode: 'EE',
  },
  coordinates: null,
  timezone: 'Europe/Tallinn',
  contacts: { email: 'demo@example.com', phone: '+3720000000' },
  website: null,
  socialLinks: [],
  languageCodes: ['en', 'et'],
  coverAssetId: null,
  status: 'APPROVED',
  version: 3,
  organization: ['Estonia Diocese', 'Tallin Deanery'],
}

const serviceTimes = [
  { id: 's1', weekday: 7, localTime: '10:00', label: 'Sunday Service', languageCode: 'et' },
]

const pastors = [
  { id: 'p1', name: 'Pastor A', introduction: 'Bio', pastoralRole: 'Pastor', imageAssetId: null },
]

describe('FormChurchProfileTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockClear()
    access.canEdit = true
  })

  it('renders all tabs and loads pastors from API', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: pastors } })

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    // Check basic details render
    expect(screen.getByText('Church Name *')).toBeTruthy()
    expect(screen.getByText('Grace')).toBeTruthy()

    // Location & Contact renders
    await userEvent.click(screen.getByText('Location & Contact'))
    expect(screen.getByLabelText('Address')).toBeTruthy()

    // Pastors dynamically loaded
    await userEvent.click(screen.getByText('Pastors'))
    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/pastors')
    })
    expect(await screen.findByText('Pastor A')).toBeTruthy()
    expect(screen.getByText('Pastor')).toBeTruthy()
    expect(screen.getByText('Bio')).toBeTruthy()
    expect(screen.getAllByText('Edit')[0]).toBeTruthy()

    // Service Times
    await userEvent.click(screen.getByText('Service Times'))
    expect(screen.getByDisplayValue('Sunday Service')).toBeTruthy()
    expect(screen.getByDisplayValue('10:00')).toBeTruthy()
  })

  it('triggers onSubmit with correctly merged payload and removes nulls', async () => {
    axiosMock.get.mockResolvedValueOnce({ data: { result: pastors } })
    const submitSpy = vi.fn().mockResolvedValue({ ...profile, version: 4 })
    const submitScheduleSpy = vi.fn()
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={submitSpy}
        onSubmitSchedule={submitScheduleSpy}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1)
    })

    const payload = submitSpy.mock.calls[0][0]

    // Checks that `baseProfile` fields are retained (like version)
    expect(payload.version).toBe(3)
    expect(payload.timezone).toBe('Europe/Tallinn')

    // Checks that server-only fields are stripped out
    expect(payload.status).toBeUndefined()
    expect(payload.approved_by).toBeUndefined()

    // Checks that nested nulls were removed so Zod validation passes
    expect(payload.address.line2).toBeUndefined()
    expect(payload.address.postalCode).toBeUndefined()
    expect(payload.address.countryCode).toBe('EE')
  })

  it('shows a distinct error state when assigned pastors cannot be loaded', async () => {
    axiosMock.get.mockRejectedValueOnce(new Error('Network error'))

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Pastors'))

    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalled()
    })
    expect(screen.getByText('Assigned pastors could not be loaded')).toBeTruthy()
  })

  it('shows a distinct empty state for a church without assigned pastors', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: [] } })
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Pastors'))
    expect(await screen.findByText('No pastors are assigned to this church.')).toBeTruthy()
  })

  it('hides church-specific edit controls without pastor update permission', async () => {
    access.canEdit = false
    axiosMock.get.mockResolvedValue({ data: { result: pastors } })
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Pastors'))
    expect(await screen.findByText('Pastor A')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
  it('renders Placement, Timezone, Cover Image, and Hero Image placeholders on Details tab', () => {
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )
    expect(screen.getByText('Placement')).toBeTruthy()
    expect(screen.getByText('Estonia Diocese / Tallin Deanery')).toBeTruthy()
    expect(screen.getByText(/Placement is set when the Church is created/)).toBeTruthy()
    expect(screen.getByText('Timezone')).toBeTruthy()
    expect(screen.getByText('Cover Image')).toBeTruthy()
    expect(screen.getByText('Hero Image')).toBeTruthy()
    expect(screen.getAllByText('Upload').length).toBeGreaterThanOrEqual(2)
  })

  it('renders fallback copy for placement when organization hierarchy is empty', () => {
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={{ ...profile, organization: [] } as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )
    expect(screen.getByText('Not placed in the hierarchy')).toBeTruthy()
  })

  it('renders map fallback in Location tab', async () => {
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Location & Contact' }))
    const picker = screen.getByTestId('gm-picker')
    expect(picker).toBeTruthy()
    expect(picker.className).toContain('bg-[#ECEEF0]')
    expect(screen.getByText('Find address')).toBeTruthy()
    expect(screen.getByText('Clear marker')).toBeTruthy()
  })

  it('updates coordinates via map picker and saves, and clears coordinates on clear', async () => {
    const user = userEvent.setup()
    const submitSpy = vi.fn().mockResolvedValue({ ...profile, version: 4 })

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={
          {
            ...profile,
            coordinates: { latitude: 58.0, longitude: 26.0 },
          } as unknown as ChurchProfileOutput
        }
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={submitSpy}
        onSubmitSchedule={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Location & Contact' }))

    await user.click(screen.getByText('Find address'))

    await user.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1)
    })
    expect(submitSpy.mock.calls[0][0].coordinates).toEqual({ latitude: 59.4, longitude: 24.7 })

    await user.click(screen.getByText('Clear marker'))

    await user.click(screen.getByText('Save'))
    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(2)
    })
    expect(submitSpy.mock.calls[1][0].coordinates).toBeNull()
  })

  it('allows adding and removing social links in Location & Contact tab', async () => {
    const user = userEvent.setup()
    const submitSpy = vi.fn().mockResolvedValue({ ...profile, version: 4 })

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={submitSpy}
        onSubmitSchedule={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Location & Contact' }))

    // Add social link
    await user.click(screen.getByText('Add social link'))
    expect(screen.getByPlaceholderText('https://facebook.com/...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Remove social link' })).toBeTruthy()

    // Remove social link
    await user.click(screen.getByRole('button', { name: 'Remove social link' }))
    expect(screen.queryByPlaceholderText('https://facebook.com/...')).toBeNull()
  })

  it('save with unchanged schedule does not call onSubmitSchedule', async () => {
    const submitSpy = vi.fn().mockResolvedValue({ ...profile, version: 4 })
    const submitScheduleSpy = vi.fn()

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={submitSpy}
        onSubmitSchedule={submitScheduleSpy}
      />,
    )

    await userEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledTimes(1)
    })

    expect(submitScheduleSpy).not.toHaveBeenCalled()
  })

  it('save with edited schedule calls onSubmitSchedule with PATCH-returned version', async () => {
    const submitSpy = vi.fn().mockResolvedValue({ ...profile, version: 4 })
    const submitScheduleSpy = vi.fn()

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={submitSpy}
        onSubmitSchedule={submitScheduleSpy}
      />,
    )

    await userEvent.click(screen.getByText('Service Times'))
    const panel = screen.getByRole('tabpanel')
    await userEvent.click(within(panel).getAllByText('Edit')[0])

    // Edit label of the existing service time
    const labelInput = await screen.findByDisplayValue('Sunday Service')
    await userEvent.clear(labelInput)
    await userEvent.type(labelInput, 'Sunday Worship')

    await userEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(submitScheduleSpy).toHaveBeenCalledTimes(1)
    })

    expect(submitScheduleSpy).toHaveBeenCalledWith({
      version: 4,
      schedule: [
        {
          weekday: 7,
          localTime: '10:00',
          label: 'Sunday Worship',
          languageCode: 'et',
        },
      ],
    })
  })

  it('onSubmit rejection skips schedule PUT', async () => {
    const submitSpy = vi.fn().mockRejectedValue(new Error('Profile update failed'))
    const submitScheduleSpy = vi.fn()

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={submitSpy}
        onSubmitSchedule={submitScheduleSpy}
      />,
    )

    await userEvent.click(screen.getByText('Service Times'))
    const panel = screen.getByRole('tabpanel')
    await userEvent.click(within(panel).getAllByText('Edit')[0])

    const labelInput = await screen.findByDisplayValue('Sunday Service')
    await userEvent.clear(labelInput)
    await userEvent.type(labelInput, 'Sunday Worship')
    await userEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalled()
    })

    expect(submitScheduleSpy).not.toHaveBeenCalled()
  })

  it('submits church-specific pastor role changes and closes on success', async () => {
    axiosMock.get.mockResolvedValue({ data: { result: pastors } })
    axiosMock.patch.mockResolvedValue({
      data: { result: { ...pastors[0], pastoralRole: 'Lead Pastor' } },
    })
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Pastors'))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    const role = within(dialog).getByLabelText('Church role')
    await userEvent.clear(role)
    await userEvent.type(role, 'Lead Pastor')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/churches/c1/pastors/p1', {
        version: 3,
        pastoral_role: 'Lead Pastor',
        image_asset_id: null,
      }),
    )
    await waitFor(() => expect(screen.getByRole('dialog').className).toContain('ant-zoom-leave'))
  })

  it('sends null when removing a church-specific pastor image', async () => {
    const pastorWithImage = { ...pastors[0], imageAssetId: 'asset-1' }
    axiosMock.get.mockImplementation(async (url: string) =>
      url.includes('/pastors')
        ? { data: { result: [pastorWithImage] } }
        : { data: { result: { url: 'https://example.test/pastor.jpg' } } },
    )
    axiosMock.patch.mockResolvedValue({
      data: { result: { ...pastorWithImage, imageAssetId: null } },
    })
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByText('Pastors'))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Remove Image' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(axiosMock.patch).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/pastors/p1',
        expect.objectContaining({ image_asset_id: null }),
      ),
    )
  })

  it.each([
    [409, 'STALE_VERSION', 'This church has changed. Refresh and try again.'],
    [422, 'INVALID_IMAGE_ASSET', 'Image must be ready and owned by this church.'],
  ])(
    'keeps the edit modal open after a %s assignment error',
    async (status, errorCode, details) => {
      axiosMock.get.mockResolvedValue({ data: { result: pastors } })
      const error = new Error('Pastor update failed') as Error & {
        isAxiosError: boolean
        response: unknown
      }
      error.isAxiosError = true
      error.response = { status, data: { error_code: errorCode, details } }
      axiosMock.patch.mockRejectedValueOnce(error)
      renderWithProviders(
        <FormChurchProfileTabs
          initialValues={profile as unknown as ChurchProfileOutput}
          serviceTimes={serviceTimes}
          churchId="c1"
          onSubmit={vi.fn()}
          onSubmitSchedule={vi.fn()}
        />,
      )

      await userEvent.click(screen.getByText('Pastors'))
      await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
      const dialog = await screen.findByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(axiosMock.patch).toHaveBeenCalled())
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(await screen.findByText(details)).toBeTruthy()
    },
  )

  it('renders Gallery tab with existing items and supports caption edit and removal', async () => {
    const profileWithGallery = {
      ...profile,
      galleryItems: [
        {
          id: 'g1',
          mediaAssetId: 'm1',
          caption: 'Altar & stained glass',
          orderIndex: 0,
          url: '/images/church.jpeg',
        },
        {
          id: 'g2',
          mediaAssetId: 'm2',
          caption: 'Nave from west door',
          orderIndex: 1,
          url: '/images/church.jpeg',
        },
      ],
    }
    const submitSpy = vi.fn().mockResolvedValue({ ...profileWithGallery, version: 4 })

    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profileWithGallery as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="c1"
        onSubmit={submitSpy}
        onSubmitSchedule={vi.fn()}
      />,
    )

    // Click Gallery tab
    await userEvent.click(screen.getByText('Gallery'))
    expect(screen.getByText('Sanctuary Gallery')).toBeTruthy()
    expect(screen.getByDisplayValue('Altar & stained glass')).toBeTruthy()
    expect(screen.getByDisplayValue('Nave from west door')).toBeTruthy()

    // Edit caption of first item
    const captionInput = screen.getByDisplayValue('Altar & stained glass')
    await userEvent.clear(captionInput)
    await userEvent.type(captionInput, 'Restored altar')

    // Remove second item
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i })
    // removeButtons include the "Remove Image" from Cover, so gallery remove buttons are present
    const galleryRemove = removeButtons[removeButtons.length - 1]
    await userEvent.click(galleryRemove)

    // Submit form
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalled()
    })

    const payload = submitSpy.mock.calls[0][0]
    expect(payload.galleryItems).toEqual([
      {
        id: 'g1',
        mediaAssetId: 'm1',
        caption: 'Restored altar',
        orderIndex: 0,
      },
    ])
  })
})
