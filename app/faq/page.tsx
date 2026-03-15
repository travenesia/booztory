"use client"

import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function FAQPage() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="FAQ" />
      <section className="py-6 px-6 max-w-[650px] mx-auto w-full touch-pan-y">
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="text-center mb-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
              <p className="text-sm text-gray-700 leading-relaxed text-left">
                Booztory is a decentralized digital spotlight built on Base. Rent a 15-minute featured slot for just 1 USDC and get your content seen by the world. Support creators you love — or earn support from your audience — through on-chain donations.
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
                <span className="font-medium text-gray-900">Is Booztory available in my country?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-sm text-gray-700 space-y-2">
                  <p>
                    <strong>Yes — Booztory is globally accessible.</strong>
                  </p>
                  <p>Since it runs on Base, all you need is a Web3 wallet and some USDC to get started.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="payments" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-medium text-gray-900">How do payments work?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-sm text-gray-700 space-y-3">
                  <p>
                    Each 15-minute slot costs <strong>1 USDC</strong>. Submitting is a two-step on-chain flow:
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
                      <span>Your slot is minted as an ERC-721 token on Base</span>
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
                <span className="font-medium text-gray-900">Which platforms are supported?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-sm text-gray-700 space-y-4">
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
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-yellow-600 mb-2">Coming soon:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span>Instagram</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span>Custom image, video, and text uploads</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-medium text-gray-900">What can I do on Booztory?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-sm text-gray-700 space-y-3">
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
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="roadmap" className="bg-gray-0 rounded-lg border border-gray-300">
              <AccordionTrigger className="text-left hover:no-underline py-4 px-4 text-sm">
                <span className="font-medium text-gray-900">What's next for Booztory?</span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pt-2 px-4">
                <div className="text-sm text-gray-700 space-y-3">
                  <p>
                    <strong>Booztory is currently live on Base Sepolia Testnet.</strong>
                  </p>
                  <div>
                    <p className="font-medium text-teal-600 mb-2">On the roadmap:</p>
                    <ul className="space-y-1 ml-4">
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Base Chain mainnet launch</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Base Mini App</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Farcaster Mini App</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Creator analytics dashboard</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-teal-600 rounded-full"></span>
                        <span>Reward pool for top creators</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      <Navbar />
    </main>
  )
}
