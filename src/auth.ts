import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
declare module 'next-auth' {
  /**
   * Returned by `auth`, `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user: User
  }

  // eslint-disable-next-line no-unused-vars
  export interface User {
    name?: string | null | undefined
    email?: string | null | undefined
    user_id: string
    role: {
      id: string
      name: string
    }
  }
}

// The `JWT` interface can be found in the `next-auth/jwt` submodule
// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
import { User } from 'next-auth'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JWT } from 'next-auth/jwt'
import { loginUser } from './controller/authentication'
import { getUserByEmail } from './controller/user'
declare module 'next-auth/jwt' {
  /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
  // eslint-disable-next-line no-unused-vars
  interface JWT {
    /** OpenID ID Token */
    idToken?: string
    user: User
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: 'jwt',
    ...(process.env.APP_ENV === 'PROD' && {
      cookies: {
        sessionToken: {
          options: { sameSite: 'none', secure: true },
        },
      },
    }),
  },
  providers: [
    Credentials({
      credentials: {
        name: {},
        password: {},
      },
      authorize: async (credentials) => {
        const email = credentials.name as string
        const password = credentials.password as string
        const userSession = await loginUser({ email: email, password: password })
        if (!userSession?.role) {
          return null
        }
        return {
          user_id: userSession?.id,
          role: {
            id: userSession.role.id,
            name: userSession.role.name,
          },
          email: userSession.email,
          name: userSession.name,
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token }) => {
      const email = token.email as string
      const result = await getUserByEmail({ email: email })
      if (!result?.role) {
        return null
      }
      token = {
        ...token,
        user: {
          role: {
            id: result.role.id,
            name: result.role.name,
          },
          user_id: result.id,
          email: result.email,
          name: result.name,
        },
      }
      return token
    },
    session: ({ session, token }) => {
      session.user = { ...token.user, ...session.user }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
