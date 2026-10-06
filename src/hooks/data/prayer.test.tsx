import { App } from 'antd'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { axiosMock, createTestQueryClient, Providers, resolveGet } from '@/test/frontend/render'
import {
  usePrayers,
  usePrayer,
  useCreatePrayer,
  usePatchPrayer,
  useApproveText,
  useEnqueueAudio,
  usePrayerAudio,
  useApproveAudio,
  useSchedulePrayer,
  usePublishPrayer,
  audioPollInterval,
} from './prayer'

const prayers = [
  { id: 'p1', title: 'Test Prayer 1', version: 1 },
  { id: 'p2', title: 'Test Prayer 2', version: 1 },
]

describe('Prayer Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    axiosMock.get.mockClear()
    axiosMock.post.mockClear()
    axiosMock.put.mockClear()
    axiosMock.patch.mockClear()
    axiosMock.delete.mockClear()
  })

  describe('usePrayers', () => {
    it('fetches list with exact query params and returns data + total', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(prayers, 2) })
      const { result } = renderHook(() => usePrayers({ churchId: 'c1' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toEqual(prayers)
      expect(result.current.total).toBe(2)
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers?page=1&limit=25&order_by=created_at&order_direction=desc',
      )
    })

    it('omits search when empty and includes it when set', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet(prayers, 2) })
      const { result } = renderHook(() => usePrayers({ churchId: 'c1', search: 'advent' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(axiosMock.get).toHaveBeenCalledWith(expect.stringMatching(/&search=advent$/))
    })

    it('does not fetch when enableFetch is false', () => {
      renderHook(() => usePrayers({ churchId: 'c1', enableFetch: false }), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
    })
  })

  describe('usePrayer', () => {
    it('fetches detail', async () => {
      axiosMock.get.mockResolvedValue({ data: { result: prayers[0] } })
      const { result } = renderHook(() => usePrayer('c1', 'p1'), { wrapper: Providers })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toEqual(prayers[0])
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/prayers/p1')
    })
  })

  describe('useCreatePrayer', () => {
    it('creates prayer, invalidates, and returns unwrapped result', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'p3', title: 'New' } } })

      const { result } = renderHook(() => useCreatePrayer('c1'), { wrapper })
      const res = await result.current.onCreate({
        title: 'New',
        body: 'Body',
        languageCode: 'en',
      } as never)

      expect(res).toEqual({ id: 'p3', title: 'New' })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers',
        expect.objectContaining({ title: 'New' }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayers'] })
    })

    it('propagates error without swallowing', async () => {
      axiosMock.post.mockRejectedValueOnce(new Error('x'))
      const { result } = renderHook(() => useCreatePrayer('c1'), { wrapper: Providers })

      await expect(
        result.current.onCreate({ title: 'New', body: 'Body', languageCode: 'en' } as never),
      ).rejects.toThrow('x')
    })
  })

  describe('usePatchPrayer', () => {
    it('patches prayer and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.patch.mockResolvedValue({ data: { result: { id: 'p1', version: 2 } } })

      const { result } = renderHook(() => usePatchPrayer('c1', 'p1'), { wrapper })
      await result.current.onPatch({ version: 2, title: 'Updated' } as never)

      expect(axiosMock.patch).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1',
        expect.objectContaining({ version: 2, title: 'Updated' }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayers'] })
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayer'] })
    })
  })

  describe('useApproveText', () => {
    it('approves text and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })

      const { result } = renderHook(() => useApproveText('c1', 'p1'), { wrapper })
      await result.current.onApproveText({ version: 1, prayerVersionId: 'v1' } as never)

      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1/approve-text',
        expect.objectContaining({ version: 1, prayerVersionId: 'v1' }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayers'] })
    })
  })

  describe('useEnqueueAudio', () => {
    it('enqueues audio with idempotency-key and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'a1' } } })

      const { result } = renderHook(() => useEnqueueAudio('c1', 'p1'), { wrapper })
      await result.current.onEnqueueAudio({
        version: 1,
        prayerVersionId: 'v1',
        voiceProfileId: 'vo1',
      } as never)

      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1/audio',
        expect.objectContaining({ voiceProfileId: 'vo1' }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
        }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayer-audio'] })
    })
  })

  describe('usePrayerAudio', () => {
    it('fetches audio state', async () => {
      axiosMock.get.mockResolvedValue({ data: { result: { id: 'a1', status: 'QUEUED' } } })
      const { result } = renderHook(() => usePrayerAudio('c1', 'p1', 'a1'), { wrapper: Providers })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/churches/c1/prayers/p1/audio/a1')
      expect(result.current.data).toEqual({ id: 'a1', status: 'QUEUED' })
    })
  })

  describe('audioPollInterval', () => {
    it('returns 2000 for active states', () => {
      expect(audioPollInterval({ state: { data: { status: 'QUEUED' } } })).toBe(2000)
      expect(audioPollInterval({ state: { data: { status: 'GENERATING' } } })).toBe(2000)
    })

    it('returns false for terminal states', () => {
      expect(audioPollInterval({ state: { data: { status: 'READY' } } })).toBe(false)
      expect(audioPollInterval({ state: { data: { status: 'APPROVED' } } })).toBe(false)
      expect(audioPollInterval({ state: { data: { status: 'FAILED' } } })).toBe(false)
    })

    it('returns false for missing data', () => {
      expect(audioPollInterval({ state: {} })).toBe(false)
    })
  })

  describe('useApproveAudio', () => {
    it('approves audio and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'a1' } } })

      const { result } = renderHook(() => useApproveAudio('c1', 'p1', 'a1'), { wrapper })
      await result.current.onApproveAudio({ version: 1, prayerVersionId: 'v1' } as never)

      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1/audio/a1/approve',
        expect.objectContaining({ version: 1, prayerVersionId: 'v1' }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayer-audio'] })
    })
  })

  describe('useSchedulePrayer', () => {
    it('schedules prayer and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.put.mockResolvedValue({ data: { result: { id: 'p1' } } })

      const { result } = renderHook(() => useSchedulePrayer('c1', 'p1'), { wrapper })
      const isoDateTime = new Date().toISOString()
      await result.current.onSchedule({
        version: 1,
        prayerVersionId: 'v1',
        scheduledAt: isoDateTime,
      } as never)

      expect(axiosMock.put).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1/schedule',
        expect.objectContaining({ scheduledAt: isoDateTime }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayers'] })
    })
  })

  describe('usePublishPrayer', () => {
    it('publishes prayer with idempotency-key and invalidates', async () => {
      const client = createTestQueryClient()
      const spy = vi.spyOn(client, 'invalidateQueries')
      const wrapper = ({ children }: { children: ReactNode }) => (
        <Providers client={client}>{children}</Providers>
      )
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'p1' } } })

      const { result } = renderHook(() => usePublishPrayer('c1', 'p1'), { wrapper })
      await result.current.onPublish({ version: 1, prayerVersionId: 'v1' } as never)

      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/c1/prayers/p1/publish',
        expect.objectContaining({ version: 1, prayerVersionId: 'v1' }),
        expect.objectContaining({
          headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
        }),
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayers'] })
    })
  })

  it('usePatchPrayer error contract (409): displays STALE_VERSION custom notification', async () => {
    const mockError = vi.fn()
    const useAppSpy = vi.spyOn(App, 'useApp').mockReturnValue({
      notification: { error: mockError, success: vi.fn() },
    } as unknown as ReturnType<typeof App.useApp>)

    const { result } = renderHook(() => usePatchPrayer('c1', 'p1'), { wrapper: Providers })

    const staleError = new Error('Conflict') as Error & { isAxiosError: boolean; response: unknown }
    staleError.isAxiosError = true
    staleError.response = { data: { error_code: 'STALE_VERSION' } }
    axiosMock.patch.mockRejectedValueOnce(staleError)

    await expect(result.current.onPatch({} as never)).rejects.toThrow()

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Version Conflict',
        description: expect.stringContaining('Please refresh your browser'),
      }),
    )

    useAppSpy.mockRestore()
  })
})
