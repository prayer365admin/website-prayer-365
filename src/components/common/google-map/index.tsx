'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChurchIcon } from '@/components/icon/church'
import { CompassIcon } from '@/components/icon/compass'
import { LayersIcon } from '@/components/icon/layers'
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import { AimOutlined, MinusOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Input, Typography } from 'antd'

export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API ?? process.env.GOOGLE_MAPS_API ?? ''
export const getGoogleMapsApiKey = () => GOOGLE_MAPS_API_KEY

export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'
export const getGoogleMapsMapId = () => GOOGLE_MAPS_MAP_ID

export type GoogleMapPoint = {
  id: string
  latitude: number
  longitude: number
  label: string
}

const DEFAULT_CENTER = { lat: 59.437, lng: 24.754 } // Tallinn
export const SANCTUARY_MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{ color: '#F8FAFC' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#D4E9FD' }],
  },
  {
    featureType: 'water',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { color: '#E0F2E5' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4B6B54' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }, { weight: 2 }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.local',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }, { weight: 2.5 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#DCE4ED' }, { weight: 1 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#FFFFFF' }, { weight: 3.5 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#D0DCE7' }, { weight: 1.5 }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }, { weight: 3 }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#1E293B' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }, { weight: 3 }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
]

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

function CameraHandler({ center, zoom }: { center?: { lat: number; lng: number }; zoom?: number }) {
  const map = useMap()
  const prevCenterRef = useRef(center)
  const prevZoomRef = useRef(zoom)

  useEffect(() => {
    if (!map || !center) return
    if (
      !prevCenterRef.current ||
      prevCenterRef.current.lat !== center.lat ||
      prevCenterRef.current.lng !== center.lng
    ) {
      prevCenterRef.current = center
      map.panTo({ lat: center.lat, lng: center.lng })
    }
  }, [map, center])

  useEffect(() => {
    if (!map || zoom == null) return
    if (prevZoomRef.current !== zoom) {
      prevZoomRef.current = zoom
      map.setZoom(zoom)
    }
  }, [map, zoom])

  return null
}
function CustomMapMarker({
  position,
  title,
  onClick,
  zIndex,
  children,
}: {
  position: { lat: number; lng: number }
  title?: string
  onClick?: () => void
  zIndex?: number
  children?: React.ReactNode
}) {
  const map = useMap()
  const [container] = useState(() => {
    if (typeof document !== 'undefined') {
      const el = document.createElement('div')
      el.setAttribute('data-testid', 'marker')
      return el
    }
    return null
  })

  useEffect(() => {
    if (!map || !container) return
    if (typeof google === 'undefined' || !google.maps?.OverlayView) return

    container.style.position = 'absolute'
    container.style.zIndex = String(zIndex ?? 1)

    class CustomOverlay extends google.maps.OverlayView {
      onAdd() {
        const panes = this.getPanes()
        panes?.overlayMouseTarget?.appendChild(container!)
      }
      draw() {
        const projection = this.getProjection()
        if (!projection) return
        const pos = new google.maps.LatLng(position.lat, position.lng)
        const point = projection.fromLatLngToDivPixel(pos)
        if (point) {
          container!.style.left = `${point.x}px`
          container!.style.top = `${point.y}px`
          container!.style.transform = 'translate(-50%, -50%)'
        }
      }
      onRemove() {
        if (container?.parentNode) {
          container.parentNode.removeChild(container)
        }
      }
    }

    const overlay = new CustomOverlay()
    overlay.setMap(map)

    return () => {
      overlay.setMap(null)
    }
  }, [map, position.lat, position.lng, zIndex, container])

  if (!container) return null

  return createPortal(
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={title}
      className="inline-block cursor-pointer select-none"
    >
      {children ?? title}
    </div>,
    container,
  )
}

export function GoogleMapPins({
  points,
  activeId,
  onSelect,
  className,
  zoom = 9,
  center: controlledCenter,
  allowEmpty = false,
  customMarkers = false,
  mapTypeId = 'roadmap',
  styles = SANCTUARY_MAP_STYLES,
  children,
}: {
  points: GoogleMapPoint[]
  activeId?: string
  onSelect?: (id: string) => void
  className?: string
  zoom?: number
  center?: { lat: number; lng: number }
  allowEmpty?: boolean
  customMarkers?: boolean
  mapTypeId?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain'
  styles?: google.maps.MapTypeStyle[]
  children?: React.ReactNode
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

  const activePoint = useMemo(
    () => validPoints.find((p) => p.id === activeId),
    [validPoints, activeId],
  )

  const initialCenter = useMemo(() => {
    if (controlledCenter) return controlledCenter
    if (activePoint) return { lat: activePoint.latitude, lng: activePoint.longitude }
    if (validPoints.length === 1)
      return { lat: validPoints[0].latitude, lng: validPoints[0].longitude }
    return DEFAULT_CENTER
  }, [controlledCenter, activePoint, validPoints])

  if (!GOOGLE_MAPS_API_KEY || (!allowEmpty && validPoints.length === 0)) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-[#ECEEF0] text-gray-400 ${
          className ?? 'h-[360px] w-full'
        }`}
        aria-label="Map unavailable"
      >
        {children}
      </div>
    )
  }
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className ?? 'h-[360px] w-full'}`}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geocoding', 'marker']}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={initialCenter}
          defaultZoom={zoom ?? 13}
          mapTypeId={mapTypeId}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          styles={styles}
        >
          {activePoint && (
            <PanToLocation center={{ lat: activePoint.latitude, lng: activePoint.longitude }} />
          )}
          <CameraHandler center={controlledCenter} zoom={zoom} />
          {validPoints.map((p) => {
            const isSelected = p.id === activeId
            return (
              <CustomMapMarker
                key={p.id}
                position={{ lat: p.latitude, lng: p.longitude }}
                title={p.label}
                zIndex={isSelected ? 100 : 1}
                onClick={onSelect ? () => onSelect(p.id) : undefined}
              >
                {customMarkers ? (
                  isSelected ? (
                    <div className="relative flex flex-col items-center cursor-pointer pointer-events-auto">
                      <div className="absolute -top-10 z-30 flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#191C1E] px-2.5 py-1 text-xs font-semibold text-white shadow-xl">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        <span>{p.label} (Selected)</span>
                      </div>
                      <div className="relative flex h-14 w-14 items-center justify-center">
                        <div className="absolute h-14 w-14 animate-pulse rounded-full bg-[#005CAD]/30 pointer-events-none" />
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#005CAD] text-white shadow-md">
                          <ChurchIcon centered className="text-[16px] text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ECEEF0] bg-white text-[#005CAD] shadow-sm transition hover:scale-110 cursor-pointer pointer-events-auto">
                      <ChurchIcon centered className="text-[14px] text-[#005CAD]" />
                    </div>
                  )
                ) : isSelected ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#005CAD] text-white shadow-md">
                    <ChurchIcon centered className="text-[12px] text-white" />
                  </div>
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-[#005CAD]/80 text-white shadow-sm">
                    <ChurchIcon centered className="text-[10px] text-white" />
                  </div>
                )}
              </CustomMapMarker>
            )
          })}
        </Map>
        {children}
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
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [mapZoom, setMapZoom] = useState(latitude != null && longitude != null ? 14 : 11)
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap')

  const hasCoords =
    latitude !== null &&
    latitude !== undefined &&
    !isNaN(latitude) &&
    longitude !== null &&
    longitude !== undefined &&
    !isNaN(longitude)

  const currentCenter = useMemo(
    () => (hasCoords ? { lat: latitude!, lng: longitude! } : DEFAULT_CENTER),
    [hasCoords, latitude, longitude],
  )
  const [center, setCenter] = useState(currentCenter)

  const handleSearch = async (rawQuery: string) => {
    const q = rawQuery.trim()
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
        const nextPoint = { lat: loc.lat, lng: loc.lng }
        setCenter(nextPoint)
        setMapZoom(14)
        onChange({ latitude: nextPoint.lat, longitude: nextPoint.lng })
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
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 w-full">
        <Input
          placeholder="Find address"
          aria-label="Find address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={() => handleSearch(query)}
          prefix={<SearchOutlined className="text-neutral-400 mr-1.5 text-sm" />}
          className="!h-10 !rounded-lg !border-[#64748b] hover:!border-primary-500 focus-within:!border-primary-500 !py-0 !px-3 text-sm flex-1 [&_.ant-input]:!h-full [&_.ant-input]:!border-0 [&_.ant-input]:!p-0 [&_.ant-input]:!shadow-none [&_.ant-input]:!bg-transparent [&_.ant-input-prefix]:!flex [&_.ant-input-prefix]:!items-center"
        />
        <Button
          type="primary"
          className="!h-10 !rounded-lg px-4 text-xs font-semibold inline-flex items-center justify-center shrink-0"
          onClick={() => handleSearch(query)}
          loading={searching}
        >
          Find address
        </Button>
        <Button
          className="!h-10 !rounded-lg px-3.5 text-xs font-semibold !border-[#64748b] text-neutral-700 hover:!text-neutral-900 hover:!border-neutral-900 shrink-0"
          onClick={() => {
            setQuery('')
            onChange(null)
          }}
        >
          Clear marker
        </Button>
      </div>
      {notFound && <Typography.Text type="warning">Address not found</Typography.Text>}
      {!GOOGLE_MAPS_API_KEY ? (
        <div
          className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-[#ECEEF0] bg-[#F4F8FA] text-gray-500"
          aria-label={label}
        >
          Map unavailable
        </div>
      ) : (
        <div
          className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-[#ECEEF0] bg-[#F4F8FA] shadow-[0_4px_24px_-4px_rgba(0,92,173,0.12)]"
          aria-label={label}
        >
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['geocoding', 'marker']}>
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={currentCenter}
              defaultZoom={mapZoom}
              mapTypeId={mapType}
              gestureHandling="greedy"
              disableDefaultUI
              clickableIcons={false}
              styles={SANCTUARY_MAP_STYLES}
              onClick={(e) => {
                // SAFETY: Fallback for Google Maps event object structure in react-google-maps wrapper
                const fallbackLatLng = (
                  e as unknown as { latLng?: { lat?: () => number; lng?: () => number } }
                ).latLng
                const latLng = e.detail?.latLng ?? fallbackLatLng
                const lat =
                  typeof latLng?.lat === 'function' ? (latLng.lat as () => number)() : latLng?.lat
                const lng =
                  typeof latLng?.lng === 'function' ? (latLng.lng as () => number)() : latLng?.lng
                if (lat != null && lng != null) {
                  const nextPoint = { lat: Number(lat), lng: Number(lng) }
                  setCenter(nextPoint)
                  onChange({ latitude: nextPoint.lat, longitude: nextPoint.lng })
                }
              }}
            >
              <CameraHandler center={hasCoords ? currentCenter : center} zoom={mapZoom} />

              {/* Top-Left Floating Header Badge matching /churches */}
              <div className="pointer-events-none absolute left-3.5 top-3.5 z-10">
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#ECEEF0] bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur-md">
                  <CompassIcon className="text-[13px] text-[#2F7AD2]" aria-hidden="true" />
                  <span className="text-[11px] font-bold tracking-wider text-[#414752] uppercase">
                    {label ? `${label} • ` : ''}SANCTUARY MAP
                  </span>
                </div>
              </div>

              {/* Top-Right Floating Controls matching /churches */}
              <div className="absolute right-3.5 top-3.5 z-10 flex flex-col items-end gap-2.5">
                {/* Zoom Controls */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-[#ECEEF0] bg-white/95 shadow-md backdrop-blur-md">
                  <button
                    type="button"
                    aria-label="Zoom in"
                    onClick={() => setMapZoom((z) => Math.min(z + 1, 18))}
                    className="flex h-8 w-8 items-center justify-center text-slate-700 transition hover:bg-slate-50 hover:text-primary-500"
                  >
                    <PlusOutlined className="text-xs font-bold" />
                  </button>
                  <div className="h-[1px] w-full bg-[#ECEEF0]" />
                  <button
                    type="button"
                    aria-label="Zoom out"
                    onClick={() => setMapZoom((z) => Math.max(z - 1, 4))}
                    className="flex h-8 w-8 items-center justify-center text-slate-700 transition hover:bg-slate-50 hover:text-primary-500"
                  >
                    <MinusOutlined className="text-xs font-bold" />
                  </button>
                </div>

                {/* Center on My Location */}
                <button
                  type="button"
                  aria-label="Center on my location"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const nextPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                          setCenter(nextPoint)
                          setMapZoom(14)
                          onChange({ latitude: nextPoint.lat, longitude: nextPoint.lng })
                        },
                        () => {},
                      )
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-slate-50 hover:text-primary-500"
                >
                  <AimOutlined className="text-sm" />
                </button>

                {/* Toggle Layer */}
                <button
                  type="button"
                  aria-label="Toggle map layer"
                  onClick={() => setMapType((t) => (t === 'roadmap' ? 'hybrid' : 'roadmap'))}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-slate-700 shadow-md backdrop-blur-md transition hover:bg-slate-50 hover:text-primary-500"
                >
                  <LayersIcon className="text-sm" />
                </button>
              </div>

              {/* Custom Sanctuary Church Pin matching /churches */}
              {hasCoords && (
                <CustomMapMarker position={currentCenter} title={label} zIndex={100}>
                  <div className="relative flex flex-col items-center pointer-events-auto">
                    <div className="relative flex h-14 w-14 items-center justify-center">
                      <div className="absolute h-14 w-14 animate-pulse rounded-full bg-[#005CAD]/30 pointer-events-none" />
                      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#005CAD] text-white shadow-md">
                        <ChurchIcon centered className="text-[20px] text-white" />
                      </div>
                    </div>
                  </div>
                </CustomMapMarker>
              )}
            </Map>
          </APIProvider>
        </div>
      )}
    </div>
  )
}
