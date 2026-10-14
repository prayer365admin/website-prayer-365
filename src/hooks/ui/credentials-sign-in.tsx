import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/*
 * Email + password sign-in shared by the customer (/login) and staff
 * (/admin/login) forms. Success → `redirectTo` (a path, or a function that
 * resolves one after sign-in, e.g. from setup progress); unverified email → the verify
 * page (with resend). Any other failure returns the NextAuth error code so
 * each form shows its own copy.
 */
export const useCredentialsSignIn = (redirectTo: string | (() => Promise<string>)) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onSignIn = async ({
    email,
    password,
  }: {
    email: string
    password: string
  }): Promise<string | null> => {
    setLoading(true)
    try {
      const result = await signIn('credentials', { name: email, password, redirect: false })

      if (!result?.error) {
        router.push(typeof redirectTo === 'string' ? redirectTo : await redirectTo())
        return null
      }
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        router.push(`/verify-account?email=${encodeURIComponent(email)}`)
        return null
      }
      return result.code ?? 'SIGN_IN_FAILED'
    } finally {
      setLoading(false)
    }
  }

  return { onSignIn, loading }
}
