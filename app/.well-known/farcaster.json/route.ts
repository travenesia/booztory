function withValidProperties(
  properties: Record<string, undefined | string | string[]>
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) =>
      Array.isArray(value) ? value.length > 0 : !!value
    )
  )
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL as string

  return Response.json({
    accountAssociation: {
      header:
        "eyJmaWQiOjE5Njk3LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4NTM4NURhMThBQ0Y5YjdkOTA5YzkxQmU4NzY3NzgzMjE0NEYzQkQ1NSJ9",
      payload: "eyJkb21haW4iOiJ3d3cuYm9venRvcnkuY29tIn0",
      signature:
        "zRnJg7trfI730JqYK8uJEtFL5ak7+0DkTpg32sAjo9p8axguKFErf52vDiqqPfFN7mob8JW1KqxIbF/wRWtPexs=",
    },
    miniapp: withValidProperties({
      version: "1",
      name: "Booztory",
      homeUrl: URL,
      iconUrl: `${URL}/logo-color.png`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: "#ffffff",
      webhookUrl: `${URL}/api/webhook`,
      subtitle: "On-chain content spotlight",
      description:
        "Pay 1 USDC for a 15-minute featured slot. No algorithm. No gatekeepers.",
      primaryCategory: "social",
      heroImageUrl: `${URL}/hero.png`,
      tagline: "Your content. On-chain.",
      ogTitle: "Booztory",
      ogDescription:
        "Pay 1 USDC for a 15-minute featured content slot on Base.",
      ogImageUrl: `${URL}/hero.png`,
    }),
  })
}
