export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string

  return Response.json({
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    miniapp: {
      version: "1",
      name: "Booztory",
      homeUrl: URL,
      iconUrl: `${URL}/logo-color.svg`,
      splashImageUrl: `${URL}/logo-color.svg`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${URL}/api/webhook`,
      subtitle: "On-chain content spotlight",
      description: "Pay 1 USDC for a 15-minute featured slot. No algorithm. No gatekeepers.",
      primaryCategory: "social",
      tags: ["content", "creator", "base", "onchain"],
      heroImageUrl: `${URL}/hero.png`,
      tagline: "Your content. On-chain.",
      ogTitle: "Booztory",
      ogDescription: "Pay 1 USDC for a 15-minute featured content slot on Base.",
      ogImageUrl: `${URL}/hero.png`,
    },
  })
}
