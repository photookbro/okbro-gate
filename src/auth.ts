import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'

const config = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
}

const { handlers, signIn, signOut, auth } = NextAuth(config)

export { handlers, signIn, signOut, auth }