import Image from 'next/image'

/** Staff auth card header (logo, product name, encryption pill), shared by every /admin auth screen. */
export default function AuthCardHeader({ showEncrypted = true }: { showEncrypted?: boolean } = {}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
        <Image
          src="/images/logo.png"
          width={40}
          height={40}
          alt="Prayer 365"
          className="h-9 w-9 sm:h-10 sm:w-10"
          style={{ objectFit: 'contain' }}
        />
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-sm font-semibold text-[#0E203E] sm:text-base">
            Prayer 365
          </span>
          <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[1.8px] text-[#475569] sm:text-[10px] sm:tracking-[2px]">
            PORTAL AUTH
          </span>
        </div>
      </div>
      {showEncrypted && (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D3FAEF] bg-[#EDFDF9] px-2 py-0.5 text-[11px] font-semibold text-[#09A97C] sm:px-2.5 sm:py-1 sm:text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-[#09A97C]" aria-hidden="true" />
          Encrypted 256-bit
        </span>
      )}
    </div>
  )
}
