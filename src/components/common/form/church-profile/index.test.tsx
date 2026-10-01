import { renderWithProviders, axiosMock } from '@/test/frontend/render'
import { ChurchProfileOutput } from '@/models/church'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
  accessibility: 'Ramp access',
  coverAssetId: null,
  status: 'APPROVED',
  version: 3,
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
    expect(screen.getByLabelText('Church name')).toBeTruthy()
    expect(screen.getByDisplayValue('Grace')).toBeTruthy()

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

  it('handles API error when fetching pastors gracefully', async () => {
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

    // Should still render pastors tab but empty
    await waitFor(() => {
      expect(axiosMock.get).toHaveBeenCalled()
    })
    expect(screen.getByText('Photo')).toBeTruthy()
  })
  it('renders cover image placeholder on Details tab when no coverAssetId', () => {
    renderWithProviders(
      <FormChurchProfileTabs
        initialValues={profile as unknown as ChurchProfileOutput}
        serviceTimes={serviceTimes}
        churchId="church-1"
        onSubmit={vi.fn()}
        onSubmitSchedule={vi.fn()}
      />,
    )
    expect(screen.getAllByText('Cover image')[0]).toBeTruthy()
    expect(screen.getByText('Upload')).toBeTruthy()
  })

  it('renders map placeholder in Location tab', async () => {
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
    expect(screen.getByText('Map / location marker')).toBeTruthy()
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

    const labelInput = await screen.findByDisplayValue('Sunday Service')
    await userEvent.clear(labelInput)
    await userEvent.type(labelInput, 'Sunday Worship')
    await userEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalled()
    })

    expect(submitScheduleSpy).not.toHaveBeenCalled()
  })
})
