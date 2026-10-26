import Image from 'next/image'

/** Staff auth card header (logo, product name, encryption pill), shared by every /admin auth screen. */
export default function AuthCardHeader({ showEncrypted = true }: { showEncrypted?: boolean } = {}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <Image
          src="/images/logo.png"
          width={40}
          height={40}
          alt="Prayer 365"
          style={{ objectFit: 'contain' }}
        />
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-base font-semibold text-[#0E203E]">
            Prayer 365
          </span>
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[2px] text-[#475569]">
            PORTAL AUTH
          </span>
        </div>
      </div>
      {showEncrypted && (
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#D3FAEF] bg-[#EDFDF9] px-2.5 py-1 text-xs font-semibold text-[#09A97C]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#09A97C]" aria-hidden="true" />
          Encrypted 256-bit
        </span>
      )}
    </div>
  )
}
