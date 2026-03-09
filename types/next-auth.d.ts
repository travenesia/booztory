import "next-auth"
import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    walletAddress: string
    username: string
  }

  interface Session {
    user: {
      id: string
      walletAddress: string
      username: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    walletAddress: string
    username: string
  }
}
