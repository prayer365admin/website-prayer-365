import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from 'antd'
import { render } from '@testing-library/react'
import { ReactNode } from 'react'
import { vi } from 'vitest'

// hoisted mocks so vi.mock factories (hoisted above imports) can reference them
const {
  pushMock,
  replaceMock,
  signInMock,
  sessionMock,
  pathnameMock,
  axiosMock,
  searchParamsMock,
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  sessionMock: vi.fn(),
  pathnameMock: vi.fn(() => '/dashboard/customers'),
  replaceMock: vi.fn(),
  signInMock: vi.fn(),
  axiosMock: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    isAxiosError: (e: unknown) => e instanceof Error && 'isAxiosError' in e,
  },
  searchParamsMock: {
    get: vi.fn((_key: string) => null as string | null),
    toString: vi.fn(() => ''),
  },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: pathnameMock,
  useSearchParams: () => searchParamsMock,
  useParams: () => ({ id: 'r1', churchId: 'c1' }),
}))
vi.mock('next-auth/react', () => ({
  useSession: (...args: unknown[]) =>
    sessionMock(...args) || { data: null, status: 'unauthenticated' },
  signIn: signInMock,
  getSession: async () => (sessionMock() || { data: null }).data,
}))

vi.mock('axios', () => ({ default: axiosMock }))

export { pushMock, replaceMock, signInMock, sessionMock, pathnameMock, axiosMock, searchParamsMock }

export type AxiosResolvedData = { result: unknown; total?: number }

/** resolve axios.get result like backend: { result: data, total } */
export function resolveGet(data: unknown, total?: number) {
  return { result: data, total }
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
    },
  })
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const queryClient = client ?? createTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <App>{children}</App>
    </QueryClientProvider>
  )
}

export function renderWithProviders(ui: ReactNode, client?: QueryClient) {
  return render(<Providers client={client}>{ui}</Providers>)
}
