import { SiweMessage } from "siwe"
import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { createPublicClient, http } from "viem"
import { base } from "viem/chains"
import { redis } from "@/lib/ratelimit"

// Public client used for SIWE signature verification.
// verifySiweMessage handles all account types:
//   - EOA: standard ECDSA recovery
//   - Deployed smart wallet: EIP-1271 isValidSignature() call
//   - Counterfactual smart wallet: ERC-6492 universal verifier (Base Account before first tx)
const publicClient = createPublicClient({
  chain: base,
  transport: http(
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : "https://mainnet.base.org"
  ),
})

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — persists across browser restarts
  },
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

          // verifySiweMessage validates all SIWE fields (domain, nonce, expiry) AND the
          // signature — using ERC-6492 universal verifier so it works for:
          //   EOA, deployed smart wallets (EIP-1271), and counterfactual smart wallets.
          const isValid = await publicClient.verifySiweMessage({
            message: siweMessage.prepareMessage(),
            signature: credentials.signature as `0x${string}`,
            nonce: credentials.nonce,
          })

          if (!isValid) return null

          const address = siweMessage.address.toLowerCase()
          const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`
          return { id: address, walletAddress: address, username: displayName }
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
    CredentialsProvider({
      id: "worldapp-wallet",
      name: "World App Wallet",
      credentials: {
        payload: { label: "Payload", type: "text" }, // JSON: { address, message, signature }
        nonce:   { label: "Nonce",   type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.payload || !credentials?.nonce) return null
        try {
          const { verifySiweMessage } = await import("@worldcoin/minikit-js/siwe")
          const payload = JSON.parse(credentials.payload)
          const verification = await verifySiweMessage(payload, credentials.nonce)
          if (!verification.isValid) return null
          const address = verification.siweMessageData.address.toLowerCase()
          const displayName = `${address.slice(0, 6)}...${address.slice(-4)}`
          return { id: address, walletAddress: address, username: displayName }
        } catch (error) {
          console.error("World App auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.userId = user.id
        token.walletAddress = user.walletAddress
        token.username = user.username
      }
      // Always re-check Redis so deleting the key revokes worldVerified.
      // Small overhead (1 Redis call per JWT refresh) but necessary for World App
      // where there's no manual sign-out — auto sign-in would otherwise re-bake stale true.
      if (token.walletAddress) {
        const nullifier = await redis.get(`worldVerified:${token.walletAddress}`)
        token.worldVerified = !!nullifier
      }
      // Allow client to set worldVerified via useSession().update()
      if (trigger === "update" && session?.worldVerified) {
        token.worldVerified = true
      }
      return token
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
        session.user.walletAddress = token.walletAddress as string
        session.user.username = token.username as string
        session.user.worldVerified = token.worldVerified ?? false
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
}
