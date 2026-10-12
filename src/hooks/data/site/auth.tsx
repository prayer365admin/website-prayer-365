import { SiteMessageKey } from '@/i18n/messages'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'

// Customer signup (WB1 sign-up step 3). Shared endpoint, strict: locale and
// main church are required by registerUser.
const baseUrl = '/api/v1/auth/signup'

export type SignupPayload = {
  full_name: string
  email: string
  password: string
  locale: string
  main_church_id: string
}

export type SignupResult = { id: string; email: string; name: string }

/** Backend error_code → the form field it belongs to and the message to show there. */
export const SIGNUP_ERRORS: Record<
  string,
  { field: keyof SignupPayload; message: SiteMessageKey }
> = {
  INVALID_FULL_NAME: { field: 'full_name', message: 'signUpErrorName' },
  INVALID_EMAIL: { field: 'email', message: 'signUpErrorEmail' },
  USER_EXISTS: { field: 'email', message: 'signUpErrorExists' },
  INVALID_PASSWORD: { field: 'password', message: 'signUpErrorPassword' },
  INVALID_MAIN_CHURCH: { field: 'main_church_id', message: 'signUpErrorChurch' },
  INVALID_LOCALE: { field: 'locale', message: 'signUpErrorLocale' },
}

export const useSignup = () => {
  const { mutateAsync, isPending, error } = useMutation({
    mutationFn: async (payload: SignupPayload) => {
      // The design has no confirm-password field; the shared route still checks it.
      const result = await axios.post(baseUrl, { ...payload, confirm_password: payload.password })
      return result.data.result as SignupResult
    },
  })

  const errorCode: string | null = error
    ? (axios.isAxiosError(error) && error.response?.data?.error_code) || 'UNKNOWN'
    : null

  return {
    onSignup: mutateAsync,
    loading: isPending,
    /** Field-level error for the form, or null when the failure has no field (show a general error). */
    fieldError: errorCode ? (SIGNUP_ERRORS[errorCode] ?? null) : null,
    failed: !!errorCode,
  }
}
