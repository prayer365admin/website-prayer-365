'use client'

import axios from 'axios'
import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function PastorImage({
  imageAssetId,
  churchId,
  name,
  size = 48,
}: {
  imageAssetId: string | null
  churchId: string | null
  name: string
  size?: number
}) {
  const [loaded, setLoaded] = useState<{ key: string; src: string } | null>(null)
  const imageKey = `${imageAssetId ?? ''}:${churchId ?? ''}`

  useEffect(() => {
    let active = true
    if (!imageAssetId || !churchId) return () => undefined

    axios
      .get(`/api/v1/uploads/${imageAssetId}/access?churchId=${encodeURIComponent(churchId)}`)
      .then((response) => {
        if (active && response.data?.result?.url) {
          setLoaded({ key: imageKey, src: response.data.result.url })
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [churchId, imageAssetId, imageKey])

  if (!loaded || loaded.key !== imageKey) {
    return (
      <div
        className="shrink-0 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs"
        style={{ width: size, height: size }}
        aria-label={`${name} image placeholder`}
      >
        {name.trim().charAt(0).toUpperCase() || 'P'}
      </div>
    )
  }

  return (
    <Image
      src={loaded.src}
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      alt={name}
    />
  )
}
