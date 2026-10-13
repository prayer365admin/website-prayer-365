import Image from 'next/image'
import Link from 'next/link'
import {
  AimOutlined,
  AppstoreOutlined,
  CompassOutlined,
  MinusOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useSiteI18n } from '@/i18n/site-i18n'
import { MobileChurchSummary } from '@/models/mobile'
import { ChurchIcon } from './church-icon'

const PIN_SLOTS = [
  { left: '42.6%', top: '54.5%' },
  { left: '34.5%', top: '47.4%' },
  { left: '40.5%', top: '45.4%' },
  { left: '71.4%', top: '41.4%' },
  { left: '29.5%', top: '72.3%' },
  { left: '81.6%', top: '31.7%' },
]

export default function SanctuaryMap({
  churches,
  total,
  selectedId,
  onSelect,
}: {
  churches: MobileChurchSummary[]
  total?: number
  selectedId?: string
  onSelect: (id: string) => void
}) {
  const { t } = useSiteI18n()

  const activeId = selectedId ?? churches[0]?.id
  const selectedChurch = churches.find((c) => c.id === activeId) ?? churches[0]

  const hasCluster = Boolean(total && total > 6)
  const visibleChurches = hasCluster ? churches.slice(0, 5) : churches.slice(0, 6)

  return (
    <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-[#ECEEF0] bg-white shadow-[0_4px_24px_-4px_rgba(0,92,173,0.12)] lg:h-[720px]">
      {/* SVG Map Canvas */}
      <svg
        viewBox="0 0 658 718"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="landGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F6F9FC" />
            <stop offset="100%" stopColor="#EDF2F7" />
          </linearGradient>
          <linearGradient id="seaGrad" x1="0%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#B6D7F7" />
            <stop offset="100%" stopColor="#CAE3FC" />
          </linearGradient>
        </defs>

        {/* Land Background */}
        <rect width="658" height="718" fill="url(#landGrad)" />

        {/* Sea Band */}
        <rect width="658" height="240" fill="url(#seaGrad)" />
        <line
          x1="0"
          y1="190"
          x2="658"
          y2="190"
          stroke="#90C0EF"
          strokeWidth="2"
          strokeDasharray="8 6"
        />

        {/* Sea Labels */}
        <text
          x="329"
          y="80"
          textAnchor="middle"
          fill="#16629B"
          opacity="0.7"
          fontSize="12"
          fontWeight="600"
          letterSpacing="3"
        >
          TALLINN BAY • GULF OF FINLAND
        </text>
        <text
          x="329"
          y="105"
          textAnchor="middle"
          fill="#2B59AC"
          opacity="0.6"
          fontSize="10"
          fontWeight="500"
        >
          80 km to Helsinki Diocese
        </text>

        {/* Sand Blob */}
        <path
          d="M100 180 C150 170 210 180 230 195 C210 210 150 205 110 200 C80 195 80 185 100 180 Z"
          fill="#EEE5D8"
          stroke="#D8C5B0"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        {/* Two Park Blobs (Kadriorg Park) */}
        <path
          d="M450 270 C480 250 550 260 570 290 C590 320 560 370 530 380 C490 390 440 370 430 330 C420 300 430 280 450 270 Z"
          fill="#D9EEDD"
          stroke="#BFE1C6"
          strokeWidth="1.5"
        />
        <path
          d="M470 400 C500 390 540 405 550 430 C560 455 530 475 500 470 C470 465 450 440 460 415 Z"
          fill="#D9EEDD"
          stroke="#BFE1C6"
          strokeWidth="1.5"
        />
        <text x="500" y="330" textAnchor="middle" fill="#487854" fontSize="10" fontWeight="600">
          Kadriorg Park
        </text>

        {/* Roads (White underlay + #D5DDE5 overlay) */}
        {/* Road 1: North-South near Kalamaja / Kristiine */}
        <path d="M170 190 L170 718" stroke="white" strokeWidth="10" strokeLinecap="round" />
        <path d="M170 190 L170 718" stroke="#D5DDE5" strokeWidth="6" strokeLinecap="round" />

        {/* Road 2: Diagonal from Kesklinn to Pirita */}
        <path d="M200 700 L500 190" stroke="white" strokeWidth="10" strokeLinecap="round" />
        <path d="M200 700 L500 190" stroke="#D5DDE5" strokeWidth="6" strokeLinecap="round" />

        {/* Road 3: Horizontal connecting West to East */}
        <path d="M80 420 L580 420" stroke="white" strokeWidth="10" strokeLinecap="round" />
        <path d="M80 420 L580 420" stroke="#D5DDE5" strokeWidth="6" strokeLinecap="round" />

        {/* Road 4: Connector through Vanalinn */}
        <path d="M260 190 L390 550" stroke="white" strokeWidth="10" strokeLinecap="round" />
        <path d="M260 190 L390 550" stroke="#D5DDE5" strokeWidth="6" strokeLinecap="round" />

        {/* District Labels */}
        <text x="130" y="260" fill="#727783" fontSize="11" fontWeight="700" letterSpacing="2">
          KALAMAJA
        </text>
        <text x="245" y="310" fill="#414752" fontSize="12" fontWeight="700" letterSpacing="2">
          VANALINN (OLD TOWN)
        </text>
        <text x="330" y="430" fill="#727783" fontSize="11" fontWeight="700" letterSpacing="2">
          KESKLINN
        </text>
        <text x="480" y="250" fill="#727783" fontSize="11" fontWeight="700" letterSpacing="2">
          KADRIORG
        </text>
        <text x="150" y="540" fill="#727783" fontSize="11" fontWeight="700" letterSpacing="2">
          KRISTIINE
        </text>
        <text x="530" y="160" fill="#727783" fontSize="11" fontWeight="700" letterSpacing="2">
          PIRITA
        </text>
      </svg>

      {/* Header Badge */}
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full border border-[#ECEEF0] bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur">
        <CompassOutlined className="text-[12px] text-primary_color" />
        <span className="text-[10px] font-semibold uppercase tracking-[2px] text-[#414752]">
          {t('mapBadge')}
        </span>
      </div>

      {/* Map Controls */}
      <div aria-hidden="true" className="absolute right-4 top-4 flex flex-col gap-2">
        <div className="flex flex-col rounded-xl border border-[#ECEEF0] bg-white/95 p-1 shadow backdrop-blur">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-[#191C1E]">
            <PlusOutlined />
          </span>
          <span className="h-px w-9 bg-[#C1C6D4]/30" />
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-[#191C1E]">
            <MinusOutlined />
          </span>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-[#005CAD] shadow backdrop-blur">
          <AimOutlined />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ECEEF0] bg-white/95 text-[#414752] shadow backdrop-blur">
          <AppstoreOutlined />
        </div>
      </div>

      {/* Pins */}
      {visibleChurches.map((c, i) => {
        const slot = PIN_SLOTS[i]
        const isSelected = c.id === activeId

        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-label={`Select ${c.name}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
            style={{ left: slot.left, top: slot.top }}
          >
            {isSelected ? (
              <div className="relative flex items-center justify-center">
                <span className="absolute -inset-3.5 rounded-full bg-[rgba(0,92,173,0.3)] animate-pulse" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#005CAD] ring-4 ring-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]">
                  <ChurchIcon className="h-5 w-5 text-white" />
                </div>
                {/* Tooltip */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md bg-[#2D3133] px-2.5 py-1 shadow">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D5E3FF]" />
                  <span className="text-xs font-semibold whitespace-nowrap text-[#EFF1F3]">
                    {c.name} ({t('selected')})
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white ring-2 ring-[rgba(22,98,155,0.2)] shadow">
                <ChurchIcon className="h-3.5 w-3.5 text-[#16629B]" />
              </div>
            )}
          </button>
        )
      })}

      {/* Cluster Pin (+N) */}
      {hasCluster && total && (
        <div
          aria-hidden="true"
          className="absolute -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 select-none items-center justify-center rounded-full bg-[#83C0FF] ring-2 ring-white shadow"
          style={{ left: PIN_SLOTS[5].left, top: PIN_SLOTS[5].top }}
        >
          <span className="text-xs font-bold text-[#191C1E]">+{total - 6}</span>
        </div>
      )}

      {/* Preview Card */}
      {selectedChurch && (
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#ECEEF0] bg-white/95 p-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#ECEEF0]">
                {selectedChurch.coverUrl ? (
                  <Image
                    src={selectedChurch.coverUrl}
                    alt={selectedChurch.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-lg font-bold text-[#5B6370]">
                    {selectedChurch.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-[#0D203E]">
                    {selectedChurch.name}
                  </span>
                  {selectedChurch.denomination && (
                    <div className="flex items-center gap-1 rounded-xl border border-primary_color/20 bg-white px-2 py-0.5 text-[10px] font-semibold text-primary_color">
                      <SafetyCertificateOutlined className="text-[10px] text-primary_color" />
                      <span>{selectedChurch.denomination}</span>
                    </div>
                  )}
                </div>
                {(selectedChurch.city || selectedChurch.distanceKm != null) && (
                  <div className="text-xs text-[#5B6370]">
                    {selectedChurch.city && <span>{selectedChurch.city}</span>}
                    {selectedChurch.city && selectedChurch.distanceKm != null && <span> • </span>}
                    {selectedChurch.distanceKm != null && (
                      <span>{selectedChurch.distanceKm} km away</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Link
              href={`/churches/${selectedChurch.id}`}
              className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-primary_color px-3.5 text-xs font-semibold text-primary_color transition hover:bg-primary_color hover:text-white"
            >
              {t('profile')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
