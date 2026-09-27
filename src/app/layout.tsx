import type { Metadata } from 'next'
import { Chakra_Petch, Orbitron } from 'next/font/google'

import GlobalProvider from '@/components/container/global-provider'

import '@/styles/global.scss'
import '@ant-design/v5-patch-for-react-19'

const fontHeading = Orbitron({ subsets: ['latin'], variable: '--font-heading' })
const fontText = Chakra_Petch({
  subsets: ['latin'],
  variable: '--font-text',
  weight: ['300', '400', '500', '600', '700'],
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
    <html lang="en">
      <body className={`${fontHeading.variable} ${fontText.variable}`} suppressHydrationWarning>
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  )
}
