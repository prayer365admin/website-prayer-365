import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
  RenderingType: {
    VECTOR: 'VECTOR',
    RASTER: 'RASTER',
    UNINITIALIZED: 'UNINITIALIZED',
  },
  Map: ({
    children,
    onClick,
    defaultCenter,
    defaultZoom,
    mapId: _mapId,
  }: {
    children?: React.ReactNode
    onClick?: (e: unknown) => void
    defaultCenter?: { lat: number; lng: number }
    defaultZoom?: number
    mapId?: string
  }) => (
    <div
      data-testid="google-map"
      data-center={JSON.stringify(defaultCenter)}
      data-zoom={defaultZoom}
      onClick={() => onClick?.({ detail: { latLng: { lat: 59.437, lng: 24.754 } } })}
    >
      {children}
    </div>
  ),
  AdvancedMarker: ({
    position,
    title,
    onClick,
    children,
  }: {
    position?: { lat: number; lng: number }
    title?: string
    onClick?: () => void
    children?: React.ReactNode
  }) => (
    <button
      type="button"
      data-testid="marker"
      data-lat={position?.lat}
      data-lng={position?.lng}
      onClick={onClick}
    >
      {title ?? 'Marker'}
      {children}
    </button>
  ),
  Pin: () => <span data-testid="pin" />,
  useMap: () => ({
    panTo: vi.fn(),
  }),
}))

import {
  GoogleMapPins,
  GoogleMapPicker,
  getGoogleMapsApiKey,
  GOOGLE_MAPS_API_KEY,
  getGoogleMapsMapId,
  GOOGLE_MAPS_MAP_ID,
} from './index'

describe('google-map shared components', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('getGoogleMapsApiKey', () => {
    it('returns the configured API key string', () => {
      expect(typeof getGoogleMapsApiKey()).toBe('string')
      expect(getGoogleMapsApiKey()).toBe(GOOGLE_MAPS_API_KEY)
    })
  })

  describe('getGoogleMapsMapId', () => {
    it('returns the configured Map ID string', () => {
      expect(typeof getGoogleMapsMapId()).toBe('string')
      expect(getGoogleMapsMapId()).toBe(GOOGLE_MAPS_MAP_ID)
    })
  })

  describe('GoogleMapPins', () => {
    it('renders fallback placeholder box when points array is empty', () => {
      const { container } = render(<GoogleMapPins points={[]} />)
      expect(screen.queryByTestId('google-map')).toBeNull()
      const box = container.querySelector('.bg-\\[\\#ECEEF0\\]')
      expect(box).toBeTruthy()
    })

    it('renders fallback box when points have NaN or invalid coordinates', () => {
      const invalidPoints = [
        { id: '1', latitude: NaN, longitude: 24.0, label: 'Invalid' },
        { id: '2', latitude: 59.0, longitude: NaN, label: 'Invalid' },
      ]
      const { container } = render(<GoogleMapPins points={invalidPoints} />)
      expect(screen.queryByTestId('google-map')).toBeNull()
      const box = container.querySelector('.bg-\\[\\#ECEEF0\\]')
      expect(box).toBeTruthy()
    })

    it('renders Map and Markers for valid points when API key exists or placeholder when empty key', () => {
      const points = [
        { id: 'p1', latitude: 59.437, longitude: 24.754, label: 'Grace' },
        { id: 'p2', latitude: 58.378, longitude: 26.729, label: 'Hope' },
      ]
      const onSelect = vi.fn()
      render(<GoogleMapPins points={points} activeId="p1" onSelect={onSelect} />)

      if (GOOGLE_MAPS_API_KEY) {
        expect(screen.getByTestId('google-map')).toBeTruthy()
        const markers = screen.getAllByTestId('marker')
        expect(markers).toHaveLength(2)
        expect(markers[0].textContent).toBe('Grace')
        expect(markers[1].textContent).toBe('Hope')

        markers[1].click()
        expect(onSelect).toHaveBeenCalledWith('p2')
      } else {
        expect(screen.getByLabelText('Map unavailable')).toBeTruthy()
      }
    })
  })

  describe('GoogleMapPicker', () => {
    it('renders Find address input and Clear button', () => {
      render(
        <GoogleMapPicker
          label="Church location"
          latitude={59.437}
          longitude={24.754}
          onChange={vi.fn()}
        />,
      )

      expect(screen.getByPlaceholderText('Find address')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy()
    })

    it('calls onChange(null) when clicking Clear', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <GoogleMapPicker
          label="Church location"
          latitude={59.437}
          longitude={24.754}
          onChange={onChange}
        />,
      )

      await user.click(screen.getByRole('button', { name: 'Clear' }))
      expect(onChange).toHaveBeenCalledWith(null)
    })

    it('calls onChange with coordinates when clicking map if key present', async () => {
      if (!GOOGLE_MAPS_API_KEY) return

      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <GoogleMapPicker
          label="Church location"
          latitude={59.437}
          longitude={24.754}
          onChange={onChange}
        />,
      )

      const map = screen.getByTestId('google-map')
      await user.click(map)
      expect(onChange).toHaveBeenCalledWith({ latitude: 59.437, longitude: 24.754 })
    })

    it('calls Google geocoding API on search and triggers onChange with location on success', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 58.378, lng: 26.729 },
              },
            },
          ],
        }),
      } as unknown as Response)

      render(
        <GoogleMapPicker
          label="Church location"
          latitude={null}
          longitude={null}
          onChange={onChange}
        />,
      )

      const searchInput = screen.getByPlaceholderText('Find address')
      await user.type(searchInput, 'Tartu')
      const searchButton = screen.getByRole('button', { name: 'Search' })
      await user.click(searchButton)

      if (GOOGLE_MAPS_API_KEY) {
        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled()
          expect(onChange).toHaveBeenCalledWith({ latitude: 58.378, longitude: 26.729 })
        })
      } else {
        expect(await screen.findByText('Address not found')).toBeTruthy()
      }
    })

    it('shows Address not found warning when geocode returns no results', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          status: 'ZERO_RESULTS',
          results: [],
        }),
      } as unknown as Response)

      render(
        <GoogleMapPicker
          label="Church location"
          latitude={null}
          longitude={null}
          onChange={onChange}
        />,
      )

      const searchInput = screen.getByPlaceholderText('Find address')
      await user.type(searchInput, 'NonExistentPlaceXYZ987')
      const searchButton = screen.getByRole('button', { name: 'Search' })
      await user.click(searchButton)

      expect(await screen.findByText('Address not found')).toBeTruthy()
      expect(onChange).not.toHaveBeenCalled()
    })

    it('renders coordinates overlay only when coordinates are provided', () => {
      const { rerender } = render(
        <GoogleMapPicker
          label="Church location"
          latitude={58.3849}
          longitude={24.4994}
          onChange={vi.fn()}
        />,
      )
      expect(screen.getByText('58.384900, 24.499400')).toBeTruthy()

      rerender(
        <GoogleMapPicker
          label="Church location"
          latitude={null}
          longitude={null}
          onChange={vi.fn()}
        />,
      )
      expect(screen.queryByText('58.384900, 24.499400')).toBeNull()
    })
  })
})
