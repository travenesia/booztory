function withValidProperties(
  properties: Record<string, undefined | string | string[] | boolean>
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([_, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined && value !== ""
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
      splashImageUrl: `${URL}/logo-white.png`,
      splashBackgroundColor: "#E63946",
      webhookUrl: `${URL}/api/webhook`,
      subtitle: "Boost Your Content, Own the Spotlight",
      description:
        "Own a spotlight on-chain. Pay 1 USDC, get 15 minutes of fame. Earn BOOZ rewards, enter weekly raffles, and boost your content on Base. No algorithm, no gatekeepers.",
      primaryCategory: "social",
      tags: ["content", "creator", "base", "onchain", "spotlight"],
      heroImageUrl: `${URL}/hero.png`,
      tagline: "Spotlight. Earn. Repeat.",
      ogTitle: "Booztory — Boost Your Content, Own the Spotlight",
      ogDescription:
        "Own a spotlight on-chain. Pay 1 USDC, get 15 minutes of fame. Earn BOOZ rewards, enter weekly raffles, and boost your content on Base.",
      ogImageUrl: `${URL}/hero.png`,
      screenshotUrls: [
        `${URL}/screenshot/screenshot1.png`,
        `${URL}/screenshot/screenshot2.png`,
        `${URL}/screenshot/screenshot3.png`,
        `${URL}/screenshot/screenshot4.png`,
      ],
      noindex: false,
    }),
  })
}
