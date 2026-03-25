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
      subtitle: "Own the Spotlight On-Chain",
      description:
        "Own a spotlight on-chain. Pay 1 USDC, get 15 minutes of fame. Earn BOOZ rewards, earn raffle entries, and boost your content on Base. No algorithm, no gatekeepers.",
      primaryCategory: "social",
      tags: ["content", "creator", "base", "onchain", "spotlight"],
      imageUrl: `${URL}/hero.jpg`,
      heroImageUrl: `${URL}/hero.jpg`,
      tagline: "Spotlight. Earn. Repeat.",
      buttonTitle: "Launch Booztory",
      castShareUrl: `https://warpcast.com/~/compose?text=Check%20out%20Booztory%20%F0%9F%94%A5%0AOwn%20the%20spotlight%20on-chain.%20Pay%201%20USDC%2C%20get%2015%20minutes.&embeds[]=${URL}`,
      ogTitle: "Booztory",
      ogDescription:
        "Pay 1 USDC, own 15 min spotlight on-chain. Earn BOOZ, enter raffles. No algorithm, no gatekeepers.",
      ogImageUrl: `${URL}/hero.jpg`,
      screenshotUrls: [
        `${URL}/screenshot/screenshot2.png`,
        `${URL}/screenshot/screenshot3.png`,
        `${URL}/screenshot/screenshot4.png`,
      ],
      noindex: false,
    }),
  })
}
