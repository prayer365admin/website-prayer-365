'use client'

import antdTheme from '@/config/antdTheme'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App as AntdApp, ConfigProvider } from 'antd'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })

export default function GlobalProvider({ children }: { children: React.ReactNode }) {
  // One client per browser session. Creating it in the render body threw the whole
  // cache away on every navigation (new `children` prop = re-render), so every page
  // started from an empty cache and re-fetched. Lazy init keeps it stable.
  // Never move this to module scope: on the server that would share one cache
  // between different users.
  const [queryClient] = useState(makeQueryClient)
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
