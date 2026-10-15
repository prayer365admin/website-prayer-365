'use client'

import Image from 'next/image'
import Link from 'next/link'
import { SafetyCertificateOutlined } from '@ant-design/icons'
import { useSiteI18n } from '@/i18n/site-i18n'
import type { MobileChurchSummary } from '@/models/mobile'

export default function MapPreviewCard({ church }: { church: MobileChurchSummary }) {
  const { t } = useSiteI18n()

  return (
    <div className="mt-3 rounded-2xl border border-[#ECEEF0] bg-white/95 p-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#ECEEF0]">
            {church.coverUrl ? (
              <Image
                src={church.coverUrl}
                alt={church.name}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-lg font-bold text-[#5B6370]">
                {church.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-[#0D203E]">{church.name}</span>
              {church.denomination && (
                <div className="flex items-center gap-1 rounded-xl border border-primary_color/20 bg-white px-2 py-0.5 text-[10px] font-semibold text-primary_color">
                  <SafetyCertificateOutlined className="text-[10px] text-primary_color" />
                  <span>{church.denomination}</span>
                </div>
              )}
            </div>
            {(church.city || church.distanceKm != null) && (
              <div className="text-xs text-[#5B6370]">
                {church.city && <span>{church.city}</span>}
                {church.city && church.distanceKm != null && <span> • </span>}
                {church.distanceKm != null && <span>{church.distanceKm} km away</span>}
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/churches/${church.id}`}
          className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary_color px-3.5 text-xs font-semibold text-primary_color transition hover:bg-primary_color hover:text-white"
        >
          {t('profile')}
        </Link>
      </div>
    </div>
  )
}
