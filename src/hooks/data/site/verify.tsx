import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Email verification (W03): confirm a token, or resend a new link. Public
// endpoints; no session.

export const errorCodeOf = (error: unknown): string | null =>
  error ? (axios.isAxiosError(error) && error.response?.data?.error_code) || 'UNKNOWN' : null

/** Seconds left from a RESEND_TOO_EARLY error ("... remaining_seconds=42 ..."), else null. */
export const remainingSecondsOf = (error: unknown): number | null => {
  const details = axios.isAxiosError(error) ? String(error.response?.data?.details ?? '') : ''
  const match = details.match(/remaining_seconds=(\d+)/)
  return match ? Number(match[1]) : null
}

export const useVerifyEmail = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (token: string) => axios.post('/api/v1/auth/verify-email', { token }),
  })
  return { onVerify: mutateAsync, verifying: isPending }
}

export const useResendVerification = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (email: string) =>
      (await axios.post('/api/v1/auth/resend-verification', { email })).data.result as {
        cooldown_seconds: number
      },
  })
  return { onResend: mutateAsync, sending: isPending }
}
