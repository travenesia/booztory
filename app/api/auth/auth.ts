import { SiweMessage } from "siwe"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      id: "ethereum-wallet",
      name: "Ethereum Wallet",
      credentials: {
        message: { label: "Message", type: "text" },
        signature: { label: "Signature", type: "text" },
        nonce: { label: "Nonce", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.message || !credentials?.signature || !credentials?.nonce) {
          return null
        }

        try {
          const siweMessage = new SiweMessage(JSON.parse(credentials.message))
          const result = await siweMessage.verify({
            signature: credentials.signature,
            nonce: credentials.nonce,
          })

          if (!result.success || !result.data.address) {
            return null
          }

          const address = result.data.address.toLowerCase()
          const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`

          // Wallet address is the user identity — no DB required
          return {
            id: address,
            walletAddress: address,
            username: displayName,
          }
        } catch (error) {
          console.error("SIWE verification error:", error)
          return null
        }
      },
    }),
    CredentialsProvider({
      id: "farcaster-quickauth",
      name: "Farcaster Quick Auth",
      credentials: {
        token: { label: "Token", type: "text" },
        address: { label: "Wallet Address", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token || !credentials?.address) return null

        try {
          const { createClient } = await import("@farcaster/quick-auth")
          const client = createClient()
          const domain = new URL(process.env.NEXT_PUBLIC_URL!).hostname
          await client.verifyJwt({ token: credentials.token, domain })

          const address = credentials.address.toLowerCase()
          const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`

          return {
            id: address,
            walletAddress: address,
            username: displayName,
          }
        } catch (error) {
          console.error("Quick Auth verification error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.walletAddress = user.walletAddress
        token.username = user.username
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
        session.user.walletAddress = token.walletAddress as string
        session.user.username = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
}
