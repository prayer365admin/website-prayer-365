import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google, { type GoogleProfile } from 'next-auth/providers/google'

declare module 'next-auth' {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the SessionProvider React Context
   */
  interface Session {
    user: User
  }

  export interface User {
    name?: string | null | undefined
    email?: string | null | undefined
    user_id: string
    /** Current user auth version; revalidated by requiredAuth / requiredWebAuth. */
    auth_version: number
    /**
     * Staff role. `null` = website customer (role_id null, SPEC §3 / decision W1):
     * a customer session carries NO permission object.
     */
    role: {
      id: string
      name: string
    } | null
  }
}

// The `JWT` interface can be found in the `next-auth/jwt` submodule
import type { Account, Profile, User } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { getOAuthUser, loginGoogleCustomer, loginUser } from './controller/authentication'
import { getUserByEmail } from './controller/user'
import { RECORD_LOGIN } from './providers/user'

declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
  interface JWT {
    /** OpenID ID Token */
    idToken?: string
    user: User
  }
}

/**
 * Credentials check (SPEC §3, website decision W1).
 * Staff sign in with their role; role-less accounts (customers created by
 * registerUser with role_id = null) sign in as a customer with `role: null` —
 * never with a fabricated staff role.
 */
export const customerAuthorize = async (credentials: Record<string, unknown>) => {
  const email = credentials.name as string
  const password = credentials.password as string
  const userSession = await loginUser({ email, password })

  if (!userSession) {
    return null
  }

  return {
    user_id: userSession.id,
    role: userSession.role ? { id: userSession.role.id, name: userSession.role.name } : null,
    auth_version: userSession.auth_version,
    email: userSession.email,
    name: userSession.name,
  }
}

export const authCallbacks = {
  signIn: async ({ account, profile }: { account?: Account | null; profile?: Profile }) => {
    if (account?.provider !== 'google') return true
    const googleProfile = profile as GoogleProfile | undefined
    if (!googleProfile?.email_verified || !googleProfile.email || !account.providerAccountId)
      return false

    const customer = await loginGoogleCustomer({
      providerAccountId: account.providerAccountId,
      email: googleProfile.email,
      name: googleProfile.name || googleProfile.email.split('@')[0],
      profilePicture: googleProfile.picture || null,
    })
    if (!customer) return false

    await RECORD_LOGIN({ user_id: customer.id, provider: 'google' })
    return true
  },
  jwt: async ({ token, account }: { token: JWT; account?: Account | null }) => {
    const result =
      account?.provider === 'google' && account.providerAccountId
        ? await getOAuthUser({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          })
        : await getUserByEmail({ email: token.email as string })

    // Unknown/deleted user ends the session. A role-less customer keeps theirs.
    if (!result) {
      return null
    }

    return {
      ...token,
      email: result.email,
      name: result.name,
      user: {
        role: result.role ? { id: result.role.id, name: result.role.name } : null,
        user_id: result.id,
        auth_version: result.auth_version,
        email: result.email,
        name: result.name,
      },
    }
  },
  session: ({ session, token }: { session: { user: User; expires: string }; token: JWT }) => {
    session.user = { ...token.user, ...session.user }
    return session
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
  },
  ...(process.env.APP_ENV === 'PROD' && {
    cookies: {
      sessionToken: {
        options: { sameSite: 'none', secure: true },
      },
    },
  }),
  providers: [
    Google,
    Credentials({
      credentials: {
        name: {},
        password: {},
      },
      authorize: customerAuthorize,
    }),
  ],
  callbacks: authCallbacks,
  pages: {
    signIn: '/login',
  },
})
