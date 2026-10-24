'use client'

import '@/utils/patch-performance-measure'
import antdTheme from '@/config/antdTheme'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import { SessionProvider } from 'next-auth/react'

export default function GlobalProvider({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
      },
    },
  })
  return (
    <AntdRegistry>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>
          <SessionProvider>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </SessionProvider>
        </AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  )
}
