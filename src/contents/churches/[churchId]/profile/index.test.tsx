import { renderWithProviders, sessionMock, axiosMock } from '@/test/frontend/render'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import ContentsChurchProfile from './index'
import { ChurchProfileInputSchema } from '@/models/church'
import { ServiceTimeScheduleInputSchema } from '@/models/service-time'

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
  { id: 's2', weekday: 3, localTime: '18:30', label: 'Midweek Bible Study', languageCode: 'et' },
]

const pastors = [
  {
    id: 'p1',
    name: 'Pastor A',
    introduction: 'Biography provided',
    pastoralRole: 'Pastor',
    imageAssetId: null,
  },
]

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>()
  return {
    ...actual,
    useParams: () => ({ churchId: 'c1' }),
  }
})

describe('Church Profile Screen', () => {
  beforeEach(() => {
    axiosMock.get.mockReset()
    axiosMock.patch.mockReset()
    axiosMock.post.mockReset()
    axiosMock.put.mockReset()
    sessionMock.mockClear()
    sessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: { id: 'r1', name: 'System administrator' } } },
      status: 'authenticated',
    })
  })

  afterEach(() => {
    sessionMock.mockReset()
    vi.restoreAllMocks()
  })
  describe('Console errors', () => {
    it('renders without antd form initialValues warnings', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Form already set 'initialValues' with path"),
      )

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Edge cases', () => {
    it('waits for both profile and service times to load before rendering form', async () => {
      let resolveServiceTimes: (value: unknown) => void
      const serviceTimesPromise = new Promise((resolve) => {
        resolveServiceTimes = resolve
      })

      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) {
          await serviceTimesPromise
          return { data: { result: serviceTimes } }
        }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)

      // While service times is loading, form should not be rendered
      expect(screen.queryByText('Church name')).toBeNull()

      // Resolve the promise to simulate network finish
      resolveServiceTimes!(undefined)

      // Form should now appear since both data sources are loaded
      expect(await screen.findByText('Church name')).toBeTruthy()
    })
  })

  describe('Details tab', () => {
    it('renders all fields and values', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)

      await screen.findByText('Details')

      expect(screen.getByLabelText('Church name')).toBeTruthy()
      expect(screen.getByPlaceholderText('Example Church')).toBeTruthy()
      expect(screen.getByLabelText('Denomination')).toBeTruthy()
      expect(screen.getByLabelText('Languages')).toBeTruthy()
      expect(screen.getByLabelText('Accessibility information')).toBeTruthy()

      expect(screen.getByDisplayValue('Grace')).toBeTruthy()
    })

    it('uploads cover image and saves with assetId', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      let postCallCount = 0
      axiosMock.post.mockImplementation(async (_url: string) => {
        postCallCount++
        if (postCallCount === 1) {
          return {
            data: { result: { assetId: 'a1', uploadUrl: 'http://localhost/s3', fields: {} } },
          }
        }
        if (postCallCount === 2) {
          return { data: { result: true } }
        }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile } } })

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      vi.stubGlobal('crypto', {
        subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      const file = new File(['hello'], 'hello.png', { type: 'image/png' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => {
        expect(axiosMock.post).toHaveBeenCalledWith(
          '/api/v1/uploads',
          expect.objectContaining({ purpose: 'IMAGE' }),
        )
        expect(axiosMock.post).toHaveBeenCalledWith(
          '/api/v1/uploads/a1/complete',
          expect.objectContaining({ checksum: expect.any(String) }),
        )
      })

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.patch).toHaveBeenCalledTimes(1)
        expect(axiosMock.patch).toHaveBeenCalledWith(
          '/api/v1/admin/churches/c1/profile',
          expect.objectContaining({ coverAssetId: 'a1' }),
        )
      })

      vi.unstubAllGlobals()
    })

    it('submits profile save payload', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile } } })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.patch).toHaveBeenCalledTimes(1)
        expect(axiosMock.patch).toHaveBeenCalledWith(
          '/api/v1/admin/churches/c1/profile',
          expect.objectContaining({ name: 'Grace', version: 3 }),
        )
      })

      const patchCall = axiosMock.patch.mock.calls[0]
      const requestData = patchCall[1]

      // Must satisfy the strict Zod schema payload expectations
      expect(() => ChurchProfileInputSchema.parse(requestData)).not.toThrow()

      expect(requestData.status).toBeUndefined()
      expect(requestData.approved_by).toBeUndefined()
      expect(requestData.approved_at).toBeUndefined()
    })

    it('uploads cover image and saves with assetId', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      let postCallCount = 0
      axiosMock.post.mockImplementation(async (_url: string) => {
        postCallCount++
        if (postCallCount === 1) {
          return {
            data: { result: { assetId: 'a1', uploadUrl: 'http://localhost/s3', fields: {} } },
          }
        }
        if (postCallCount === 2) {
          return { data: { result: true } }
        }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile } } })

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
      vi.stubGlobal('crypto', {
        subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      const file = new File(['hello'], 'hello.png', { type: 'image/png' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      await userEvent.upload(input, file)

      await waitFor(() => {
        expect(axiosMock.post).toHaveBeenCalledWith(
          '/api/v1/uploads',
          expect.objectContaining({ purpose: 'IMAGE' }),
        )
        expect(axiosMock.post).toHaveBeenCalledWith(
          '/api/v1/uploads/a1/complete',
          expect.objectContaining({ checksum: expect.any(String) }),
        )
      })

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.patch).toHaveBeenCalledTimes(1)
        expect(axiosMock.patch).toHaveBeenCalledWith(
          '/api/v1/admin/churches/c1/profile',
          expect.objectContaining({ coverAssetId: 'a1' }),
        )
      })

      vi.unstubAllGlobals()
    })
  })

  describe('Location & Contact tab', () => {
    it('shows fields', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      await userEvent.click(screen.getByText('Location & Contact'))

      await screen.findByLabelText('Address')
      expect(screen.getByLabelText('City')).toBeTruthy()
      expect(screen.getByLabelText('Website')).toBeTruthy()
      expect(screen.getByText('Social links (optional)')).toBeTruthy()
    })
  })

  describe('Service Times tab', () => {
    it('shows service times', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      await userEvent.click(screen.getByText('Service Times'))

      await screen.findByDisplayValue('Sunday Service')
      expect(screen.getByDisplayValue('Midweek Bible Study')).toBeTruthy()
      expect(screen.getByDisplayValue('10:00')).toBeTruthy()
      expect(screen.getByDisplayValue('18:30')).toBeTruthy()
    })

    it('saves schedule through PUT with fresh version', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile, version: 4 } } })
      axiosMock.put.mockResolvedValueOnce({ data: { result: true } })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      await userEvent.click(screen.getByText('Service Times'))
      await screen.findByDisplayValue('Sunday Service')

      const labelInput = screen.getByDisplayValue('Sunday Service')
      await userEvent.clear(labelInput)
      await userEvent.type(labelInput, 'Sunday Worship')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.put).toHaveBeenCalledTimes(1)
      })

      expect(axiosMock.put).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/service-times',
        expect.objectContaining({
          version: 4,
          schedule: expect.arrayContaining([
            expect.objectContaining({
              weekday: 7,
              localTime: '10:00',
              label: 'Sunday Worship',
              languageCode: 'et',
            }),
          ]),
        }),
      )

      const putCall = axiosMock.put.mock.calls[0]
      const requestData = putCall[1]

      expect(() => ServiceTimeScheduleInputSchema.parse(requestData)).not.toThrow()
    })

    it('stale schedule (409) shows conflict notification and does not throw', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile, version: 4 } } })

      const error409 = Object.assign(new Error('Request failed with status code 409'), {
        isAxiosError: true,
        response: { data: { error_code: 'STALE_VERSION' } },
      })
      axiosMock.put.mockRejectedValueOnce(error409)

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      await userEvent.click(screen.getByText('Service Times'))
      await screen.findByDisplayValue('Sunday Service')

      const labelInput = screen.getByDisplayValue('Sunday Service')
      await userEvent.clear(labelInput)
      await userEvent.type(labelInput, 'Sunday Worship')

      const saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.put).toHaveBeenCalledTimes(1)
      })

      // Stale (409) → the hook's onError shows the conflict notification; handleReplace
      // catches the rejection so it never bubbles as an unhandled rejection.
      expect(await screen.findByText('Version Conflict')).toBeTruthy()
    })
  })

  describe('Pastors tab', () => {
    it('shows pastors list', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      await userEvent.click(screen.getByText('Pastors'))

      await screen.findByText('Pastor A')
      expect(screen.getByText('Biography provided')).toBeTruthy()
    })
  })

  describe('Save interactions', () => {
    it('save button visible and clickable across tabs', async () => {
      axiosMock.get.mockImplementation(async (url: string) => {
        if (url.includes('/pastors')) return { data: { result: pastors } }
        if (url.includes('/service-times')) return { data: { result: serviceTimes } }
        if (url.includes('/profile')) return { data: { result: profile } }
        return { data: {} }
      })
      axiosMock.patch.mockResolvedValueOnce({ data: { result: { ...profile } } })

      renderWithProviders(<ContentsChurchProfile />)
      await screen.findByText('Details')

      let saveButton = screen.getByRole('button', { name: 'Save' })
      await userEvent.click(saveButton)

      await waitFor(() => {
        expect(axiosMock.patch).toHaveBeenCalledTimes(1)
      })

      await userEvent.click(screen.getByText('Location & Contact'))
      saveButton = screen.getByRole('button', { name: 'Save' })
      expect(saveButton).toBeTruthy()

      await userEvent.click(screen.getByText('Details'))
      saveButton = screen.getByRole('button', { name: 'Save' })
      expect(saveButton).toBeTruthy()
    })
  })
})
