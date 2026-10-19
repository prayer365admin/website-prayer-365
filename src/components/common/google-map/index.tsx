'use client'

import { useEffect, useMemo, useState } from 'react'
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps'
import { Button, Input, Typography } from 'antd'

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API ?? ''
export const getGoogleMapsApiKey = () => GOOGLE_MAPS_API_KEY

export type GoogleMapPoint = {
  id: string
  latitude: number
  longitude: number
  label: string
}

const DEFAULT_CENTER = { lat: 59.437, lng: 24.754 } // Tallinn

function centerOf(points: GoogleMapPoint[]): { lat: number; lng: number } {
  if (points.length === 0) return DEFAULT_CENTER
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.latitude, lng: acc.lng + p.longitude }),
    { lat: 0, lng: 0 },
  )
  return { lat: sum.lat / points.length, lng: sum.lng / points.length }
}

function PanToLocation({ center }: { center?: { lat: number; lng: number } | null }) {
  const map = useMap()
  const lat = center?.lat
  const lng = center?.lng
  useEffect(() => {
    if (map && lat != null && lng != null) {
      map.panTo({ lat, lng })
    }
  }, [map, lat, lng])
  return null
}

const SELECTED_ICON = {
  path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  fillColor: '#005CAD',
  fillOpacity: 1,
  strokeColor: '#FFFFFF',
  strokeWeight: 1.5,
  scale: 1.6,
  anchor: { x: 12, y: 22 } as google.maps.Point,
}

export function GoogleMapPins({
  points,
  activeId,
  onSelect,
  className,
  zoom = 9,
}: {
  points: GoogleMapPoint[]
  activeId?: string
  onSelect?: (id: string) => void
  className?: string
  zoom?: number
}) {
  const validPoints = useMemo(
    () =>
      points.filter(
        (p) =>
          typeof p.latitude === 'number' &&
          !isNaN(p.latitude) &&
          typeof p.longitude === 'number' &&
          !isNaN(p.longitude),
      ),
    [points],
  )

  if (!GOOGLE_MAPS_API_KEY || validPoints.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-[#ECEEF0] text-gray-400 ${
          className ?? 'h-[360px] w-full'
        }`}
        aria-label="Map unavailable"
      />
    )
  }

  const center = centerOf(validPoints)
  const activePoint = validPoints.find((p) => p.id === activeId)

  return (
    <div className={`overflow-hidden rounded-2xl ${className ?? 'h-[360px] w-full'}`}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geocoding']}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={center}
          defaultZoom={zoom}
          disableDefaultUI
          clickableIcons={false}
        >
          {activePoint && (
            <PanToLocation center={{ lat: activePoint.latitude, lng: activePoint.longitude }} />
          )}
          {validPoints.map((p) => {
            const isSelected = p.id === activeId
            return (
              <Marker
                key={p.id}
                position={{ lat: p.latitude, lng: p.longitude }}
                title={p.label}
                icon={isSelected ? SELECTED_ICON : undefined}
                zIndex={isSelected ? 100 : 1}
                onClick={onSelect ? () => onSelect(p.id) : undefined}
              />
            )
          })}
        </Map>
      </APIProvider>
    </div>
  )
}

export function GoogleMapPicker({
  latitude,
  longitude,
  onChange,
  label,
}: {
  latitude?: number | null
  longitude?: number | null
  onChange: (next: { latitude: number; longitude: number } | null) => void
  label: string
}) {
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const hasCoords =
    latitude !== null &&
    latitude !== undefined &&
    !isNaN(latitude) &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(longitude)

  const currentCenter = hasCoords ? { lat: latitude!, lng: longitude! } : DEFAULT_CENTER

  const handleSearch = async (query: string) => {
    const q = query.trim()
    if (!q) return
    setNotFound(false)
    if (!GOOGLE_MAPS_API_KEY) {
      setNotFound(true)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_MAPS_API_KEY}`,
      )
      const data = await res.json()
      if (data.results && data.results.length > 0 && data.results[0].geometry?.location) {
        const loc = data.results[0].geometry.location
        onChange({ latitude: loc.lat, longitude: loc.lng })
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input.Search
          placeholder="Find address"
          aria-label="Find address"
          enterButton="Find address"
          size="small"
          onSearch={handleSearch}
          loading={searching}
        />
        <Button size="small" onClick={() => onChange(null)}>
          Clear marker
        </Button>
      </div>
      {notFound && <Typography.Text type="warning">Address not found</Typography.Text>}
      {!GOOGLE_MAPS_API_KEY ? (
        <div
          className="flex h-[284px] w-full items-center justify-center rounded bg-[#ECEEF0] text-gray-500"
          aria-label={label}
        >
          Map unavailable
        </div>
      ) : (
        <div
          className="h-[284px] w-full overflow-hidden rounded border border-[#ECEEF0]"
          aria-label={label}
        >
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geocoding']}>
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={currentCenter}
              defaultZoom={hasCoords ? 14 : 11}
              disableDefaultUI
              clickableIcons={false}
              onClick={(e) => {
                const fallbackLatLng = (
                  e as unknown as { latLng?: { lat?: () => number; lng?: () => number } }
                ).latLng
                const latLng = e.detail?.latLng ?? fallbackLatLng
                const lat =
                  typeof latLng?.lat === 'function' ? (latLng.lat as () => number)() : latLng?.lat
                const lng =
                  typeof latLng?.lng === 'function' ? (latLng.lng as () => number)() : latLng?.lng
                if (lat != null && lng != null) {
                  onChange({ latitude: Number(lat), longitude: Number(lng) })
                }
              }}
            >
              {hasCoords && (
                <>
                  <PanToLocation center={currentCenter} />
                  <Marker position={currentCenter} />
                </>
              )}
            </Map>
          </APIProvider>
        </div>
      )}
    </div>
  )
}
