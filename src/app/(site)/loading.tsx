/**
 * Group-level loading UI for the website. Shown instantly on navigation while
 * the target page renders on the server, so a click never leaves the previous
 * screen frozen with no feedback.
 *
 * Rendered inside the (site) layout, so the top bar and footer stay mounted —
 * only the content area is replaced by this skeleton. Routes with their own,
 * more specific loading file (e.g. /churches) override it.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="bg-[#F7F9FB]">
      <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Page header / hero */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="h-4 w-32 animate-pulse rounded-full bg-slate-100" />
          <div className="h-8 w-72 max-w-full animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
        </div>

        {/* Content cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]"
            >
              <div className="h-28 w-full animate-pulse rounded-xl bg-slate-100" />
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>

        {/* List block */}
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-[-1px_-1px_2px_#FFFFFF,0_1px_2px_rgba(0,0,0,0.05)]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
