"use client"

import { useState, useEffect } from "react"
import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"
import { Skeleton } from "@/components/ui/skeleton"

export default function FAQPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) {
    return (
      <main className="min-h-screen pt-12 pb-12">
        <PageTopbar title="FAQ" />
        <section className="py-6 px-6 max-w-[650px] mx-auto w-full space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </section>
        <Navbar />
      </main>
    )
  }

  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="FAQ" />
      <section className="pt-6 pb-[80px] md:pb-[56px] px-6 max-w-[650px] mx-auto w-full">
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="text-center mb-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed text-left">
                Booztory is a decentralized digital spotlight built on Base and World Chain. Pay 1 USDC to feature your content in a live slot and get seen by the world. Support creators you love — or earn support from your audience — through on-chain donations.
              </p>
            </div>
          </div>

          {/* FAQ Accordion */}
          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem
              value="availability"
              className="bg-gray-0 rounded-lg border border-gray-300"
            >
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">Is Booztory available in my country?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-2">
                  <p>
                    <strong>Yes — Booztory is globally accessible.</strong>
                  </p>
                  <p>It runs on <strong>Base</strong> and <strong>World Chain</strong>. On Base, all you need is a Web3 wallet and some USDC. On World Chain, open Booztory directly inside <strong>World App</strong> — no extra setup required.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="world-verify" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">Do I need to verify my identity?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-2">
                  <p>
                    <strong>Only if you&apos;re using Booztory inside World App.</strong> All other platforms (browser, Base App, Farcaster) have no verification requirement.
                  </p>
                  <p>
                    In World App, a one-time <strong>World ID</strong> verification (Orb scan) is required to submit content, claim daily GM, convert tickets, and enter raffles. Donating and sponsoring are open to everyone — no verification needed.
                  </p>
                  <p>
                    When the verify button appears, tap it and complete the World ID flow. It takes under a minute and is <strong>permanent</strong> — you will never be asked again.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payments" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">How do payments work?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <p>
                    Each 15-minute slot costs <strong>1 $USDC</strong>. Submitting is a two-step on-chain flow:
                  </p>
                  <ul className="space-y-2 ml-4">
                    <li className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0"></span>
                      <span>Connect your Web3 wallet</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0"></span>
                      <span>Approve the USDC spend</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0"></span>
                      <span>Your slot is minted as an ERC-721 token on Base or World Chain</span>
                    </li>
                  </ul>
                  <p className="text-teal-600 font-medium">
                    No sign-ups, no middlemen — everything settles on-chain.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="platforms" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">Which platforms are supported?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Currently supported:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>YouTube</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>YouTube Shorts</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>X (Twitter)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Spotify</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>TikTok</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Vimeo</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Twitch (live streams, VODs, clips)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Text</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">What can I do on Booztory?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <div className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-red-700 rounded-full mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="font-medium text-gray-900">Spotlight your content</p>
                      <p>Pay 1 USDC to feature your content in a live 15-minute slot</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-red-700 rounded-full mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="font-medium text-gray-900">Support creators</p>
                      <p>Send USDC donations directly to creators whose content you enjoy</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-red-700 rounded-full mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="font-medium text-gray-900">Browse the board</p>
                      <p>See what's live now, what's queued up next, and what's already aired</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="w-2 h-2 bg-red-700 rounded-full mt-2 flex-shrink-0"></span>
                    <div>
                      <p className="font-medium text-gray-900">Earn $BOOZ & points</p>
                      <p>Mint slots, donate, and claim daily GM streaks to earn $BOOZ and points — convert points into raffle tickets to win prizes</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* ── Rewards & $BOOZ ── */}
            <AccordionItem value="booz-token" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">What is $BOOZ?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <p>
                    <strong>$BOOZ is the native reward token of Booztory.</strong> It is earned by participating in the platform — no purchase required.
                  </p>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Ways to earn $BOOZ:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Mint a slot (1 USDC) — 1,000 $BOOZ + 15 points</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Donate to a creator (once per 24h) — 1,000 $BOOZ + 5 points</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Daily GM streak — 5 to 50 $BOOZ + 1 point per day</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Milestone bonuses at days 7, 14, 30, 60, and 90</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Complete the full 90-day journey — 10,000 $BOOZ total</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-gray-500">
                    $BOOZ can be spent to get discounted or free slots. See the Rewards page for your current balance.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="gm-streak" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">How does the Daily GM streak work?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <p>
                    Tap the bolt icon in the top bar once per day to claim your daily GM reward. Each consecutive day builds your 90-day journey with escalating rewards and one-time milestone bonuses.
                  </p>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Daily rewards:</p>
                    <ul className="space-y-1 ml-4">
                      {[5, 10, 15, 20, 25, 30, 35].map((amt, i) => (
                        <li key={i} className="flex items-center space-x-2">
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          <span>Day {i + 1} — {amt} $BOOZ</span>
                        </li>
                      ))}
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Days 8–90 — 50 $BOOZ per day</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Milestone bonuses (one-time):</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        <span>⚔️ Warrior — Day 7 — +50 $BOOZ</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        <span>🛡️ Elite — Day 14 — +250 $BOOZ</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        <span>👑 Epic — Day 30 — +350 $BOOZ</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        <span>🔥 Legend — Day 60 — +500 $BOOZ</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                        <span>🔱 Mythic — Day 90 — +4,560 $BOOZ (Journey Complete)</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-emerald-600 font-medium">
                    Complete all 90 days = 10,000 $BOOZ total = exactly 1 free slot mint.
                  </p>
                  <p className="text-gray-500">
                    Miss a day and the streak resets to Day 1. Milestone bonuses are permanent — if you restart, you won't earn them again. One claim per UTC day.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="raffle" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">How does the raffle work?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <p>
                    Earn points through platform activity, then convert them into raffle tickets on the Rewards page. More tickets = higher chance to win.
                  </p>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">Ways to earn points:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Mint any slot — 15 points</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Daily GM claim — 1 point per day + streak bonuses</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Donate to another creator — 5 points (once per 24h)</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="font-medium text-gray-900 text-xs mb-1">Points → Tickets</p>
                    <p className="text-xs text-gray-600">5 points = 1 raffle ticket (burned on conversion — irreversible). Unused tickets carry over to any future raffle.</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">How the draw works:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Commit tickets to a raffle — tickets are burned on entry</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>A minimum number of entries and unique wallets must participate</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Winners selected by verifiable randomness — Chainlink VRF on Base, commit-reveal on World Chain</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        <span>Prizes sent directly to winners on-chain (USDC or $BOOZ)</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-gray-500">
                    Free entry path: GM daily streak costs nothing — earn ~6 tickets per 30-day raffle for free.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sponsorship" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">How can I sponsor Booztory?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <p>
                    Sponsors get their ad displayed to all Booztory visitors for the duration of a raffle — alongside a prize pool funded by the sponsor.
                  </p>
                  <div>
                    <p className="font-medium text-gray-900 mb-2">How it works:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        <span>Submit your ad on the <strong>Sponsor</strong> page — image, embed, or text</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        <span>Pay the prize pool + platform fee in USDC upfront</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        <span>Team reviews and accepts or rejects within 3 days</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                        <span>If rejected — full refund, no questions asked</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <p className="font-medium text-gray-900 text-xs mb-1">Sponsorship tiers:</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">7 days</span>
                      <span className="text-gray-800 font-medium">200 USDC total (100 prize + 100 fee)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">14 days</span>
                      <span className="text-gray-800 font-medium">400 USDC total (200 prize + 200 fee)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">30 days</span>
                      <span className="text-gray-800 font-medium">700 USDC total (400 prize + 300 fee)</span>
                    </div>
                  </div>
                  <p className="text-gray-500">
                    Your ad appears as a toggle on the homepage and as sidebar panels on desktop. Sponsors can queue consecutive periods — ads chain automatically with no overlap.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="roadmap" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-bold text-gray-900">What's next for Booztory?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-xs text-gray-700 space-y-3">
                  <div>
                    <p className="font-medium text-green-700 mb-2">Already live:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>ERC-721 slot minting on Base</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>$BOOZ reward token + 90-day GM streak journey</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Discounted slots (burn 1,000 $BOOZ → pay 0.9 USDC)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Free slots (burn 10,000 $BOOZ → free slot)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Weekly raffle — USDC prizes (Chainlink VRF on Base · commit-reveal on World Chain)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Base Mini App + Farcaster Mini App</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>World Mini App — live on World Chain</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        <span>Creator profile &amp; analytics dashboard</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-teal-600 mb-2">Coming soon:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Superchain expansion</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 h-20 pointer-events-none z-40">
        <div className="relative h-full">
          <ProgressiveBlur height="100%" position="bottom" />
        </div>
      </div>
      <Navbar />
    </main>
  )
}
