import '@/utils/patch-performance-measure'
import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Manrope } from 'next/font/google'

import GlobalProvider from '@/components/container/global-provider'
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  THEME_COLOR,
} from '@/config/site-brand'

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
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  category: 'religion',
  // Default-deny: only the public pages opt back in with `robots.index = true`.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    url: '/welcome',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  formatDetection: { telephone: false, address: false, email: false },
}

export const viewport: Viewport = { themeColor: THEME_COLOR }

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
