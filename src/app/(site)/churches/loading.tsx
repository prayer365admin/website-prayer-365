import { ChurchCardSkeleton, MapPreviewCardSkeleton } from '@/contents/site/church-directory'

export default function Loading() {
  return (
    <div className="bg-[#F7F9FB]">
      <div className="mx-auto flex max-w-[1152px] flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Header banner skeleton */}
        <div className="isolate relative overflow-hidden rounded-2xl bg-white p-6 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="relative flex flex-col justify-between gap-4 rounded-lg bg-[#F5F7FF] p-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-32 rounded-full bg-white shadow-sm" />
                <div className="h-4 w-40 rounded bg-slate-200" />
              </div>
              <div className="h-8 w-72 rounded bg-slate-300" />
              <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
            </div>
            <div className="h-4 w-40 rounded-full bg-slate-200" />
          </div>

          {/* Search bar & filter controls skeleton */}
          <div className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-center">
            <div className="h-10 flex-1 rounded-xl bg-slate-100" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="h-10 w-32 rounded-xl bg-slate-100" />
              <div className="h-10 w-36 rounded-xl bg-slate-100" />
            </div>
          </div>

          {/* Quick filter pills skeleton */}
          <div className="flex flex-wrap items-center gap-2 pt-4">
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-8 w-28 rounded-2xl bg-slate-100" />
            <div className="h-8 w-36 rounded-2xl bg-slate-100" />
            <div className="h-8 w-32 rounded-2xl bg-slate-100" />
            <div className="h-8 w-28 rounded-2xl bg-slate-100" />
            <div className="h-8 w-28 rounded-2xl bg-slate-100" />
          </div>
        </div>

        {/* Split section */}
        <div className="grid gap-8 lg:grid-cols-[45fr_55fr]">
          {/* Left column: Card skeletons */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="h-6 w-48 rounded bg-slate-200" />
              <div className="h-4 w-20 rounded bg-slate-100" />
            </div>
            <div className="flex flex-col gap-4">
              <ChurchCardSkeleton featured />
              <ChurchCardSkeleton />
              <ChurchCardSkeleton />
              <ChurchCardSkeleton />
            </div>
          </div>

          {/* Right column: Map skeleton */}
          <div className="self-start lg:sticky lg:top-6">
            <div className="h-[480px] w-full rounded-2xl bg-slate-200 animate-pulse lg:h-[720px]" />
            <MapPreviewCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}
