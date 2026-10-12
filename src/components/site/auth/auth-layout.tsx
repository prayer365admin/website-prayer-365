import { ReactNode } from 'react'

/**
 * Sign-in / sign-up page frame (WB1 design): soft blue page, form + aside
 * columns on desktop, stacked on phones (form first). `asideFirst` puts the
 * aside on the left on desktop (sign-up); sign-in keeps the form on the left.
 */
export default function AuthLayout({
  form,
  aside,
  asideFirst = false,
}: {
  form: ReactNode
  aside: ReactNode
  asideFirst?: boolean
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#eef4fb] to-[#f7f9fc] px-4 py-10 md:px-8 lg:py-16">
      <div
        className={`mx-auto grid max-w-6xl items-start gap-6 lg:gap-8 ${
          asideFirst ? 'lg:grid-cols-[8fr_11fr]' : 'lg:grid-cols-[11fr_8fr]'
        }`}
      >
        <div className={asideFirst ? 'lg:order-2' : undefined}>{form}</div>
        <aside className="flex flex-col gap-6">{aside}</aside>
      </div>
    </main>
  )
}
