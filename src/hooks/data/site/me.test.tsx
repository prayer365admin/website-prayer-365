import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  axiosMock,
  createTestQueryClient,
  Providers,
  resolveGet,
  sessionMock,
} from '@/test/frontend/render'
import { useMe, useMyChurches } from './me'

const me = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A',
  locale: 'en',
  profilePicture: null,
  mainChurchId: 'c1',
}

const signedIn = () => sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } } })

describe('useMe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReset()
  })

  it('does not fetch without a session', () => {
    renderHook(() => useMe(), { wrapper: Providers })
    expect(axiosMock.get).not.toHaveBeenCalled()
  })

  it('fetches the profile and invalidates the user-scoped key after a patch', async () => {
    signedIn()
    axiosMock.get.mockResolvedValue({ data: resolveGet(me) })
    axiosMock.patch.mockResolvedValue({ data: resolveGet(me) })
    const client = createTestQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Providers client={client}>{children}</Providers>
    )

    const { result } = renderHook(() => useMe(), { wrapper })
    await waitFor(() => expect(result.current.data).toEqual(me))
    expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/site/me')

    await result.current.onPatch({ locale: 'fi' })
    expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/site/me', { locale: 'fi' })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['site', 'me', 'u1'] })
  })
})

describe('useMyChurches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('follows with PUT and unfollows with DELETE', async () => {
    signedIn()
    axiosMock.get.mockResolvedValue({ data: resolveGet([]) })
    axiosMock.put.mockResolvedValue({ data: {} })
    axiosMock.delete.mockResolvedValue({ data: {} })
    const { result } = renderHook(() => useMyChurches(), { wrapper: Providers })

    await result.current.onFollow({ churchId: 'c1', isFollowed: true })
    await result.current.onFollow({ churchId: 'c1', isFollowed: false })

    expect(axiosMock.put).toHaveBeenCalledWith('/api/v1/site/me/follows/c1')
    expect(axiosMock.delete).toHaveBeenCalledWith('/api/v1/site/me/follows/c1')
  })
})
