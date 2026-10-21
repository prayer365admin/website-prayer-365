import { SiteMessageKey } from '@/i18n/messages'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Customer signup (W02). Name, email and password only: language and main
// church and locale are chosen during onboarding (/customer/setup, R-06).
const baseUrl = '/api/v1/auth/signup'

export type SignupPayload = {
  full_name: string
  email: string
  password: string
}

export type SignupResult = {
  id: string
  email: string
  name: string
  verification_email_sent: boolean
}

/** Backend error_code → the form field it belongs to and the message to show there. */
export const SIGNUP_ERRORS: Record<
  string,
  { field: keyof SignupPayload; message: SiteMessageKey }
> = {
  INVALID_FULL_NAME: { field: 'full_name', message: 'signUpErrorName' },
  INVALID_EMAIL: { field: 'email', message: 'signUpErrorEmail' },
  USER_EXISTS: { field: 'email', message: 'signUpErrorExists' },
  INVALID_PASSWORD: { field: 'password', message: 'signUpErrorPassword' },
}

/**
 * Field + message for a failed signup, or null when the failure has no field
 * (network / server error: show a general message).
 */
export const signupErrorOf = (error: unknown) => {
  const code = (axios.isAxiosError(error) && error.response?.data?.error_code) || 'UNKNOWN'
  return SIGNUP_ERRORS[code] ?? null
}

export const useSignup = () => {
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (payload: SignupPayload) => {
      // The design has no confirm-password field; the shared route still checks it.
      const result = await axios.post(baseUrl, { ...payload, confirm_password: payload.password })
      return result.data.result as SignupResult
    },
  })

  return {
    onSignup: mutateAsync,
    loading: isPending,
    /** Field-level error for the form, or null when the failure has no field (show a general error). */
    fieldError: error ? signupErrorOf(error) : null,
    failed: !!error,
  }
}
