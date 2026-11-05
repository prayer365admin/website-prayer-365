import { CHURCH_NETWORK_CHIPS } from './data'

export default function WelcomeStatsStrip() {
  return (
    <section
      aria-label="Canonical Fellowship Network"
      className="bg-white border-y border-[#E6EDFB] py-4 px-6"
    >
      <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Network Label */}
        <div className="flex items-center gap-2.5 shrink-0">
          <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 19 18" width="19">
            <path
              d="M6.33333 17.5L4.75 14.8333L1.75 14.1667L2.04167 11.0833L0 8.75L2.04167 6.41667L1.75 3.33333L4.75 2.66667L6.33333 0L9.16667 1.20833L12 0L13.5833 2.66667L16.5833 3.33333L16.2917 6.41667L18.3333 8.75L16.2917 11.0833L16.5833 14.1667L13.5833 14.8333L12 17.5L9.16667 16.2917L6.33333 17.5V17.5M7.04167 15.375L9.16667 14.4583L11.3333 15.375L12.5 13.375L14.7917 12.8333L14.5833 10.5L16.125 8.75L14.5833 6.95833L14.7917 4.625L12.5 4.125L11.2917 2.125L9.16667 3.04167L7 2.125L5.83333 4.125L3.54167 4.625L3.75 6.95833L2.20833 8.75L3.75 10.5L3.54167 12.875L5.83333 13.375L7.04167 15.375V15.375M9.16667 8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75V8.75M8.29167 11.7083L13 7L11.8333 5.79167L8.29167 9.33333L6.5 7.58333L5.33333 8.75L8.29167 11.7083V11.7083"
              fill="#005CAD"
            />
          </svg>
          <span className="text-[13px] font-bold tracking-[0.65px] uppercase text-[#191C1E]">
            Canonical Fellowship Network
          </span>
        </div>

        {/* Right Church Chips: single scrollable row, scrollbar hidden */}
        <div className="flex w-full min-w-0 items-center gap-2.5 overflow-x-auto [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden lg:flex-1">
          {CHURCH_NETWORK_CHIPS.map((church) => (
            <div
              className="rounded-3xl bg-[#E6EDFB] px-3.5 py-1.5 flex items-center gap-2 shrink-0 whitespace-nowrap transition-colors hover:bg-[#d8e4f9]"
              key={church}
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-[#005CAD]" />
              <span className="text-[13px] sm:text-[14px] font-medium text-[#414752]">
                {church}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
