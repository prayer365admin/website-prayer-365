import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Password recovery (W04). Public endpoints; no session. Error helpers:
// errorCodeOf / remainingSecondsOf in ./verify.

export const useForgotPassword = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (email: string) => axios.post('/api/v1/users/forgot-password', { email }),
  })
  return { onForgot: mutateAsync, sending: isPending }
}

export const useResetPassword = () => {
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) =>
      axios.post('/api/v1/auth/reset-password', {
        token,
        new_password: password,
        confirm_password: password,
      }),
  })
  return { onReset: mutateAsync, resetting: isPending }
}
