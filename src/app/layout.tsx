import '@/utils/patch-performance-measure'
import type { Metadata } from 'next'
import { Instrument_Serif, Manrope } from 'next/font/google'

import GlobalProvider from '@/components/container/global-provider'

import '@/styles/global.scss'

const fontHeading = Manrope({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700', '800'],
})
const fontText = Manrope({
  subsets: ['latin'],
  variable: '--font-text',
  weight: ['300', '400', '500', '600', '700'],
})
const fontQuote = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-quote',
  weight: ['400'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'Catalyst Inertia | Admin Dashboard',
  description:
    'Streamlined admin dashboard for user management, master data handling, and purchase order management. Simplify data operations with an intuitive and efficient interface.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="en">
      <body
        className={`${fontHeading.variable} ${fontText.variable} ${fontQuote.variable}`}
        suppressHydrationWarning
      >
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  )
}
