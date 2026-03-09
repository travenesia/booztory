import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { SiweMessage } from "siwe"

export async function POST(req: NextRequest) {
  const { message, signature } = await req.json()

  const cookieStore = cookies()
  const storedNonce = cookieStore.get("siwe")?.value

  if (!storedNonce) {
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: "No nonce found in cookies",
    })
  }

  try {
    const siweMessage = new SiweMessage(JSON.parse(message))

    if (siweMessage.nonce !== storedNonce) {
      return NextResponse.json({
        status: "error",
        isValid: false,
        message: "Nonce mismatch",
      })
    }

    const result = await siweMessage.verify({ signature, nonce: storedNonce })
    return NextResponse.json({
      status: "success",
      isValid: result.success,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({
      status: "error",
      isValid: false,
      message: errorMessage,
    })
  }
}
