import { App } from 'antd'
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
import {
  useApproveVoiceProfile,
  useCentralVoiceProfile,
  useCentralVoiceProfiles,
  useCreateVoiceConsent,
  useCreateVoiceSubmission,
  useDisableVoiceProfile,
  useMyVoiceChurches,
  useMyVoiceSubmissions,
  usePatchVoiceSubmission,
  useRecloneVoiceProfile,
  useRejectVoiceProfile,
  useRevokeVoiceConsent,
  useSubmitVoiceSubmission,
  voiceDetailPollInterval,
  voiceKeys,
  voiceListPollInterval,
} from './voice'

const withClient = () => {
  const client = createTestQueryClient()
  const spy = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers client={client}>{children}</Providers>
  )
  return { client, spy, wrapper }
}

const idempotencyHeader = expect.objectContaining({
  headers: expect.objectContaining({ 'idempotency-key': expect.any(String) }),
})

const axiosError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error('fail'), { isAxiosError: true, response: { status, data } })

describe('Voice hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMock.mockReturnValue({ data: { user: { user_id: 'u1' } }, status: 'authenticated' })
  })

  describe('query keys + polling', () => {
    it('scopes every key by userId', () => {
      expect(voiceKeys.mine('u1')).toEqual(['voice-submissions', 'u1'])
      expect(voiceKeys.centralDetail('u1', 'v1')).toEqual(['voice-profiles', 'u1', 'detail', 'v1'])
      expect(voiceKeys.centralList('u1', { page: 1 })[1]).toBe('u1')
    })

    it('polls while registering and stops at terminal states', () => {
      const detail = (registrationState: string) => ({ state: { data: { registrationState } } })
      expect(voiceDetailPollInterval(detail('QUEUED'))).toBe(3000)
      expect(voiceDetailPollInterval(detail('REGISTERING'))).toBe(3000)
      expect(voiceDetailPollInterval(detail('REGISTRATION_UNKNOWN'))).toBe(3000)
      for (const s of ['READY', 'FAILED', 'VERIFICATION_REQUIRED', 'DISABLED', 'UNREGISTERED'])
        expect(voiceDetailPollInterval(detail(s))).toBe(false)

      const list = (states: string[]) => ({
        state: { data: { result: states.map((registrationState) => ({ registrationState })) } },
      })
      expect(voiceListPollInterval(list(['READY', 'QUEUED']))).toBe(3000)
      expect(voiceListPollInterval(list(['READY', 'FAILED']))).toBe(false)
    })
  })

  describe('pastor side', () => {
    it('lists own submissions', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet([{ id: 'v1' }], 1) })
      const { result } = renderHook(() => useMyVoiceSubmissions(), { wrapper: Providers })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(result.current.data).toEqual([{ id: 'v1' }])
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/me/voice-submissions?page=1&limit=50',
      )
    })

    it("lists the pastor's assigned churches from the own-scope endpoint", async () => {
      axiosMock.get.mockResolvedValue({ data: { result: [{ id: 'ch1', name: 'Tallinn' }] } })
      const { result } = renderHook(() => useMyVoiceChurches(), { wrapper: Providers })
      await waitFor(() => expect(result.current.data).toEqual([{ id: 'ch1', name: 'Tallinn' }]))
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/me/voice-churches')
    })

    it('exposes the error for an unlinked account', async () => {
      axiosMock.get.mockRejectedValue(axiosError(403, { error_code: 'UNLINKED_PASTOR' }))
      const { result } = renderHook(() => useMyVoiceSubmissions(), { wrapper: Providers })
      await waitFor(() => expect(result.current.error).toBeTruthy())
    })

    it('creates consent with an idempotency key', async () => {
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'c1' } } })
      const { result } = renderHook(() => useCreateVoiceConsent(), { wrapper: Providers })
      await expect(
        result.current.onCreateConsent({ evidenceAssetId: 'e1', termsVersion: '2026-1' }),
      ).resolves.toEqual({ id: 'c1' })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/me/voice-consents',
        { evidenceAssetId: 'e1', termsVersion: '2026-1' },
        idempotencyHeader,
      )
    })

    it('creates a multi-sample draft with an idempotency key and invalidates', async () => {
      const { spy, wrapper } = withClient()
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useCreateVoiceSubmission(), { wrapper })
      const payload = { sampleAssetIds: ['s1', 's2'], consentId: 'c1', churchId: 'ch1' }
      await result.current.onCreate(payload)
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/me/voice-submissions',
        payload,
        idempotencyHeader,
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['voice-submissions'] })
    })

    it('patches a draft without sending the id in the body', async () => {
      axiosMock.patch.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => usePatchVoiceSubmission(), { wrapper: Providers })
      await result.current.onPatch({ id: 'v1', version: 2, sampleAssetIds: ['s3'] })
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/me/voice-submissions/v1', {
        version: 2,
        sampleAssetIds: ['s3'],
      })
    })

    it('submits with an idempotency key', async () => {
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useSubmitVoiceSubmission(), { wrapper: Providers })
      await result.current.onSubmit({ id: 'v1', version: 3 })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/me/voice-submissions/v1/submit',
        { version: 3 },
        idempotencyHeader,
      )
    })
  })

  describe('central side', () => {
    it('lists with review filter params', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet([], 0) })
      const { result } = renderHook(() => useCentralVoiceProfiles({ reviewState: 'SUBMITTED' }), {
        wrapper: Providers,
      })
      await waitFor(() => expect(result.current.loading).toBe(false))
      expect(axiosMock.get).toHaveBeenCalledWith(
        '/api/v1/admin/central/voice-profiles?page=1&limit=25&order_by=created_at&order_direction=desc&review_state=SUBMITTED',
      )
    })

    it('passes search, submitted range, registration and sort', async () => {
      axiosMock.get.mockResolvedValue({ data: resolveGet([], 0) })
      const { result } = renderHook(
        () =>
          useCentralVoiceProfiles({
            registrationState: 'READY',
            search: 'tamm',
            submittedFrom: '2026-10-01T00:00:00.000Z',
            submittedTo: '2026-10-07T23:59:59.999Z',
            orderBy: 'reviewed_by',
            orderDirection: 'asc',
          }),
        { wrapper: Providers },
      )
      await waitFor(() => expect(result.current.loading).toBe(false))
      const url = new URL(axiosMock.get.mock.calls[0][0] as string, 'http://x')
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        order_by: 'reviewed_by',
        order_direction: 'asc',
        registration_state: 'READY',
        search: 'tamm',
        submitted_from: '2026-10-01T00:00:00.000Z',
        submitted_to: '2026-10-07T23:59:59.999Z',
      })
    })

    it('fetches detail only with an id', async () => {
      renderHook(() => useCentralVoiceProfile(null), { wrapper: Providers })
      expect(axiosMock.get).not.toHaveBeenCalled()
      axiosMock.get.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useCentralVoiceProfile('v1'), { wrapper: Providers })
      await waitFor(() => expect(result.current.data).toEqual({ id: 'v1' }))
      expect(axiosMock.get).toHaveBeenCalledWith('/api/v1/admin/central/voice-profiles/v1')
    })

    it('approves with an idempotency key', async () => {
      const { spy, wrapper } = withClient()
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useApproveVoiceProfile(), { wrapper })
      await result.current.onApprove({ id: 'v1', version: 2 })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/central/voice-profiles/v1/approve',
        { version: 2 },
        idempotencyHeader,
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['voice-profiles'] })
    })

    it('rejects with a reason', async () => {
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useRejectVoiceProfile(), { wrapper: Providers })
      await result.current.onReject({ id: 'v1', version: 2, reason: 'background noise' })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/central/voice-profiles/v1/reject',
        { version: 2, reason: 'background noise' },
      )
    })

    type Patch = (v: { id: string; version: number }) => Promise<unknown>
    it.each<[string, () => Patch]>([
      ['disable', () => useDisableVoiceProfile().onDisable],
      ['revoke_consent', () => useRevokeVoiceConsent().onRevokeConsent],
    ])('%s patches and refreshes the pastor active voice', async (action, hook) => {
      const { spy, wrapper } = withClient()
      axiosMock.patch.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(hook, { wrapper })
      await result.current({ id: 'v1', version: 4 })
      expect(axiosMock.patch).toHaveBeenCalledWith('/api/v1/admin/central/voice-profiles/v1', {
        version: 4,
        action,
      })
      expect(spy).toHaveBeenCalledWith({ queryKey: ['church-pastors'] })
      expect(spy).toHaveBeenCalledWith({ queryKey: ['church', 'pastors'] })
    })

    it('re-clone posts to the church-scoped route with an idempotency key', async () => {
      const { spy, wrapper } = withClient()
      axiosMock.post.mockResolvedValue({ data: { result: { id: 'v1' } } })
      const { result } = renderHook(() => useRecloneVoiceProfile(), { wrapper })
      await result.current.onReclone({ churchId: 'ch1', id: 'v1' })
      expect(axiosMock.post).toHaveBeenCalledWith(
        '/api/v1/admin/churches/ch1/voice-profiles/v1/reclone',
        {},
        idempotencyHeader,
      )
      expect(spy).toHaveBeenCalledWith({ queryKey: ['prayer-audio'] })
      expect(spy).toHaveBeenCalledWith({ queryKey: ['church-pastors'] })
    })

    it('surfaces the server details on a 403/409', async () => {
      const errorNotification = vi.fn()
      vi.spyOn(App, 'useApp').mockReturnValue({
        notification: { error: errorNotification, success: vi.fn() },
      } as never)
      axiosMock.post.mockRejectedValue(
        axiosError(403, { error_code: 'SELF_APPROVAL', details: 'You cannot review your own.' }),
      )
      const { result } = renderHook(() => useApproveVoiceProfile(), { wrapper: Providers })
      await expect(result.current.onApprove({ id: 'v1', version: 2 })).rejects.toThrow()
      expect(errorNotification).toHaveBeenCalledWith({
        title: 'Not Allowed',
        description: 'You cannot review your own.',
      })
    })
  })
})
