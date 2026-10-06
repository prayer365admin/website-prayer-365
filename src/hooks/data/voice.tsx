import { useMainNotification } from '@/hooks/ui/notification'
import {
  ConsentOutput,
  VoiceConsentInput,
  VoiceProfileDetail,
  VoiceProfileListItem,
  VoiceSubmissionInput,
  VoiceSubmissionPatch,
} from '@/models/voice'
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App } from 'antd'
import axios from 'axios'
import { useSession } from 'next-auth/react'

/*
 * Voice submission (S27 My Voice) + central review (S24) data hooks (F4VO VO-03).
 *
 * POSTs whose route runs `withIdempotency` (consent, create, submit, approve)
 * send a fresh `idempotency-key` per call — the server rejects an empty key.
 * Registration is async (voice.register worker): queries poll while a profile
 * is still on its way to a terminal registration state.
 */

const ME_URL = '/api/v1/admin/me'
const CENTRAL_URL = '/api/v1/admin/central/voice-profiles'

export const voiceKeys = {
  mine: (userId: string | null) => ['voice-submissions', userId] as const,
  centralList: (userId: string | null, params: Record<string, unknown>) =>
    ['voice-profiles', userId, 'list', params] as const,
  centralDetail: (userId: string | null, profileId: string) =>
    ['voice-profiles', userId, 'detail', profileId] as const,
}

export const VOICE_POLL_ACTIVE_STATES = ['QUEUED', 'REGISTERING', 'REGISTRATION_UNKNOWN'] as const

const isActive = (state?: string) => VOICE_POLL_ACTIVE_STATES.includes((state ?? '') as never)

/** Detail: poll while registering. */
export const voiceDetailPollInterval = (query: {
  state: { data?: { registrationState?: string } }
}): number | false => (isActive(query.state.data?.registrationState) ? 3000 : false)

/** Lists: poll while any row is registering. */
export const voiceListPollInterval = (query: {
  state: { data?: { result?: { registrationState?: string }[] } }
}): number | false =>
  query.state.data?.result?.some((p) => isActive(p.registrationState)) ? 3000 : false

const idempotent = () => ({ headers: { 'idempotency-key': crypto.randomUUID() } })

/** Everything a voice change can affect, incl. the pastor's active voice in church/prayer views. */
const invalidateVoice = (queryClient: QueryClient, { activeVoice = false } = {}) => {
  queryClient.invalidateQueries({ queryKey: ['voice-submissions'] })
  queryClient.invalidateQueries({ queryKey: ['voice-profiles'] })
  if (activeVoice) {
    queryClient.invalidateQueries({ queryKey: ['church-pastors'] })
    queryClient.invalidateQueries({ queryKey: ['church', 'pastors'] })
  }
}

/** Show the server's 409/422 details (stale, invalid state, self-review, bad sample…). */
const useVoiceError = () => {
  const notification = useMainNotification()
  const { notification: antdNotification } = App.useApp()

  return (error: unknown, entity: string, action: string) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data as
        | { error_code?: string; details?: string; message?: string }
        | undefined
      if (data?.error_code === 'STALE_VERSION') {
        antdNotification.error({
          title: 'Version Conflict',
          description: data.details ?? 'This submission changed. Refresh and try again.',
        })
        return
      }
      if (status === 403 || status === 409 || status === 422) {
        antdNotification.error({
          title: status === 422 ? 'Invalid Voice Submission' : 'Not Allowed',
          description:
            data?.details ?? data?.message ?? 'Review the voice submission and try again.',
        })
        return
      }
    }
    notification({ type: 'error', entity, action })
  }
}

// --- Pastor side (S27) ------------------------------------------------------

export const useMyVoiceSubmissions = ({ enableFetch = true }: { enableFetch?: boolean } = {}) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading, error } = useQuery({
    queryKey: voiceKeys.mine(userId),
    queryFn: async () => {
      const response = await axios.get(`${ME_URL}/voice-submissions?page=1&limit=50`)
      return {
        result: response.data.result as VoiceProfileListItem[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch && !!userId,
    refetchInterval: voiceListPollInterval,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading, error }
}

export const useCreateVoiceConsent = () => {
  const onError = useVoiceError()
  const { mutateAsync: onCreateConsent, isPending: loading } = useMutation({
    mutationFn: async (payload: VoiceConsentInput) => {
      const response = await axios.post(`${ME_URL}/voice-consents`, payload, idempotent())
      return response.data.result as ConsentOutput
    },
    onError: (error) => onError(error, 'voice consent', 'recorded'),
  })
  return { onCreateConsent, loading }
}

export const useCreateVoiceSubmission = () => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  const { mutateAsync: onCreate, isPending: loading } = useMutation({
    mutationFn: async (payload: VoiceSubmissionInput) => {
      const response = await axios.post(`${ME_URL}/voice-submissions`, payload, idempotent())
      return response.data.result as VoiceProfileListItem
    },
    onSuccess: () => {
      invalidateVoice(queryClient)
      notification({ type: 'success', entity: 'voice draft', action: 'saved' })
    },
    onError: (error) => onError(error, 'voice draft', 'saved'),
  })
  return { onCreate, loading }
}

export const usePatchVoiceSubmission = () => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  const { mutateAsync: onPatch, isPending: loading } = useMutation({
    mutationFn: async ({ id, ...payload }: VoiceSubmissionPatch & { id: string }) => {
      const response = await axios.patch(`${ME_URL}/voice-submissions/${id}`, payload)
      return response.data.result as VoiceProfileListItem
    },
    onSuccess: () => {
      invalidateVoice(queryClient)
      notification({ type: 'success', entity: 'voice draft', action: 'saved' })
    },
    onError: (error) => onError(error, 'voice draft', 'saved'),
  })
  return { onPatch, loading }
}

export const useSubmitVoiceSubmission = () => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  const { mutateAsync: onSubmit, isPending: loading } = useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const response = await axios.post(
        `${ME_URL}/voice-submissions/${id}/submit`,
        { version },
        idempotent(),
      )
      return response.data.result as VoiceProfileListItem
    },
    onSuccess: () => {
      invalidateVoice(queryClient)
      notification({ type: 'success', entity: 'voice submission', action: 'submitted' })
    },
    onError: (error) => onError(error, 'voice submission', 'submitted'),
  })
  return { onSubmit, loading }
}

// --- Central review side (S24) ----------------------------------------------

export interface CentralVoiceListOptions {
  page?: number
  limit?: number
  reviewState?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  registrationState?: string
  churchId?: string
  orderDirection?: 'asc' | 'desc'
  enableFetch?: boolean
}

export const useCentralVoiceProfiles = (options: CentralVoiceListOptions = {}) => {
  const {
    page = 1,
    limit = 25,
    reviewState,
    registrationState,
    churchId,
    orderDirection = 'desc',
    enableFetch = true,
  } = options
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const params = new URLSearchParams()
  params.set('page', page.toString())
  params.set('limit', limit.toString())
  params.set('order_by', 'created_at')
  params.set('order_direction', orderDirection)
  if (reviewState) params.set('review_state', reviewState)
  if (registrationState) params.set('registration_state', registrationState)
  if (churchId) params.set('churchId', churchId)

  const { data, isLoading } = useQuery({
    queryKey: voiceKeys.centralList(userId, {
      page,
      limit,
      reviewState,
      registrationState,
      churchId,
      orderDirection,
    }),
    queryFn: async () => {
      const response = await axios.get(`${CENTRAL_URL}?${params.toString()}`)
      return {
        result: response.data.result as VoiceProfileListItem[],
        total: response.data.total as number,
      }
    },
    enabled: enableFetch && !!userId,
    refetchInterval: voiceListPollInterval,
  })

  return { data: data?.result ?? [], total: data?.total ?? 0, loading: isLoading }
}

export const useCentralVoiceProfile = (profileId: string | null | undefined) => {
  const { data: session } = useSession()
  const userId = session?.user.user_id ?? null

  const { data, isLoading } = useQuery({
    queryKey: voiceKeys.centralDetail(userId, profileId ?? ''),
    queryFn: async () => {
      const response = await axios.get(`${CENTRAL_URL}/${profileId}`)
      return response.data.result as VoiceProfileDetail
    },
    enabled: !!userId && !!profileId,
    refetchInterval: voiceDetailPollInterval,
  })

  return { data, loading: isLoading }
}

export const useApproveVoiceProfile = () => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  const { mutateAsync: onApprove, isPending: loading } = useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const response = await axios.post(`${CENTRAL_URL}/${id}/approve`, { version }, idempotent())
      return response.data.result as VoiceProfileDetail
    },
    onSuccess: () => {
      invalidateVoice(queryClient)
      notification({ type: 'success', entity: 'voice submission', action: 'approved' })
    },
    onError: (error) => onError(error, 'voice submission', 'approved'),
  })
  return { onApprove, loading }
}

export const useRejectVoiceProfile = () => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  const { mutateAsync: onReject, isPending: loading } = useMutation({
    mutationFn: async ({
      id,
      version,
      reason,
    }: {
      id: string
      version: number
      reason: string
    }) => {
      const response = await axios.post(`${CENTRAL_URL}/${id}/reject`, { version, reason })
      return response.data.result as VoiceProfileDetail
    },
    onSuccess: () => {
      invalidateVoice(queryClient)
      notification({ type: 'success', entity: 'voice submission', action: 'rejected' })
    },
    onError: (error) => onError(error, 'voice submission', 'rejected'),
  })
  return { onReject, loading }
}

const useCentralVoicePatch = (action: 'disable' | 'revoke_consent', label: string) => {
  const queryClient = useQueryClient()
  const notification = useMainNotification()
  const onError = useVoiceError()
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const response = await axios.patch(`${CENTRAL_URL}/${id}`, { version, action })
      return response.data.result as VoiceProfileDetail
    },
    onSuccess: () => {
      // Disable/revoke also unsets the pastor's active voice (F4VO V4).
      invalidateVoice(queryClient, { activeVoice: true })
      notification({ type: 'success', entity: 'voice profile', action: label })
    },
    onError: (error) => onError(error, 'voice profile', label),
  })
}

export const useDisableVoiceProfile = () => {
  const { mutateAsync: onDisable, isPending: loading } = useCentralVoicePatch('disable', 'disabled')
  return { onDisable, loading }
}

export const useRevokeVoiceConsent = () => {
  const { mutateAsync: onRevokeConsent, isPending: loading } = useCentralVoicePatch(
    'revoke_consent',
    'revoked',
  )
  return { onRevokeConsent, loading }
}
