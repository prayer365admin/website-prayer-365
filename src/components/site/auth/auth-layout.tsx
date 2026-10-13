import BoxContainer from '@/components/container/boxed'
import { siteFormTheme } from '@/config/antdTheme'
// Deep import: this is a server component, and importing the 'antd' root
// from one ships the whole library as a client reference.
import ConfigProvider from 'antd/es/config-provider'
import { ReactNode } from 'react'
import s from './auth-layout.module.scss'

/**
 * Sign-in / sign-up page frame (WB1 design): soft blue page, form + aside
 * columns on desktop, stacked on phones (form first). `asideFirst` puts the
 * aside on the left on desktop (sign-up); sign-in keeps the form on the left.
 * Design widths: form 657px, aside 459px, gap 36px = 1152px container.
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
    // overflow-hidden: the 720px glow must not cause sideways scroll on phones.
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-neutral-50 py-10 lg:py-16">
      <div aria-hidden className={s.glow} />
      <BoxContainer
        sectionClassName="relative"
        containerClassName={`grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:gap-9 ${
          asideFirst
            ? 'lg:grid-cols-[minmax(0,459fr)_minmax(0,657fr)]'
            : 'lg:grid-cols-[minmax(0,657fr)_minmax(0,459fr)]'
        }`}
      >
        <div className={asideFirst ? 'lg:order-2' : undefined}>
          <ConfigProvider theme={siteFormTheme}>{form}</ConfigProvider>
        </div>
        <aside className="flex flex-col gap-6">{aside}</aside>
      </BoxContainer>
    </main>
  )
}
