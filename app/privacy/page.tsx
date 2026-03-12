"use client"

import { PageTopbar } from "@/components/layout/pageTopbar"
import { Navbar } from "@/components/layout/navbar"

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-12 pb-12">
      <PageTopbar title="Privacy Policy" />
      <section className="py-6 px-6 h-[calc(100vh-96px)] overflow-y-auto max-w-[650px] mx-auto w-full">
        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <div>
            <p className="text-xs text-gray-400">Last updated: March 2026</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p>
              Booztory is a decentralized digital spotlight platform built on Base. This Privacy Policy explains what
              information we collect, how we use it, and your rights as a user.
            </p>
          </div>

          {/* Section 1 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">1. Information We Collect</h2>
            <p>
              Booztory is a fully on-chain application. We do not operate a traditional database and do not collect
              personal information in the conventional sense. However, the following data may be processed:
            </p>
            <ul className="space-y-2 ml-4 mt-2">
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Wallet address</strong> — when you connect your Web3 wallet, your public wallet address is
                  used as your identity. This is inherent to how blockchain applications work.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Content URLs and metadata</strong> — when you submit content (YouTube, TikTok, Twitter/X,
                  Vimeo, Spotify, Twitch), the URL and associated metadata (title, author name, thumbnail) are stored
                  permanently on-chain as part of the ERC-721 token.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Transaction data</strong> — all USDC payments (slot purchases and donations) are recorded on
                  the Base blockchain and are publicly visible.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-red-700 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>ENS / Basename</strong> — if your wallet has a registered ENS name or Basename, it may be
                  resolved and displayed publicly on the platform.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 2 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">2. Authentication</h2>
            <p>
              Booztory uses Sign-In With Ethereum (SIWE) for authentication. When you connect your wallet, you sign a
              cryptographic message to verify ownership of your address. No password, email, or personal account is
              created. Your session is managed via a secure, short-lived cookie that does not store sensitive data.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">3. Third-Party Services</h2>
            <p>To support content embedding and metadata, Booztory interacts with the following third-party APIs:</p>
            <ul className="space-y-2 ml-4 mt-2">
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>YouTube oEmbed API</strong> — to fetch video titles and thumbnails
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>TikTok oEmbed API</strong> — to fetch video metadata
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Vimeo oEmbed API</strong> — to fetch video metadata
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Spotify oEmbed API</strong> — to fetch track/album metadata
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Twitch Helix API</strong> — to fetch stream, VOD, and clip metadata via server-side OAuth
                  (Client Credentials flow; no user data is accessed)
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>Alchemy</strong> — as the RPC provider for reading on-chain data from the Base blockchain
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full flex-shrink-0 mt-1.5"></span>
                <span>
                  <strong>WalletConnect / RainbowKit</strong> — to support wallet connections across devices
                </span>
              </li>
            </ul>
            <p className="mt-2">
              These services may receive your IP address or other technical data as part of normal HTTP requests. Please
              refer to their respective privacy policies for more information.
            </p>
          </div>

          {/* Section 4 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">4. On-Chain Data and Immutability</h2>
            <p>
              All content slots minted on Booztory are stored as ERC-721 tokens on the Base blockchain. This means the
              content URL, metadata, creator address, and payment history are{" "}
              <strong>permanently and publicly visible on-chain</strong>. By submitting content, you acknowledge that
              this data cannot be deleted or modified after minting.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">5. Cookies</h2>
            <p>
              Booztory uses a single session cookie for authentication purposes (SIWE nonce and session token). We do
              not use advertising cookies, tracking pixels, or analytics cookies. No cookie consent banner is required
              as no non-essential cookies are set.
            </p>
          </div>

          {/* Section 6 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">6. Data Deletion</h2>
            <p>
              Because Booztory stores all user-submitted content directly on a public blockchain, we are unable to
              delete on-chain records once they are minted. However, we do not maintain any off-chain database of user
              profiles or personal data.
            </p>
            <p className="mt-2">
              To request deletion of any off-chain data (such as session cookies or cached metadata), you can clear
              your browser cookies and local storage at any time.
            </p>
            <p className="mt-2">
              For any other data deletion requests, contact us at{" "}
              <a href="https://x.com/booztory" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
                @booztory on X
              </a>
              .
            </p>
          </div>

          {/* Section 7 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">7. Children&apos;s Privacy</h2>
            <p>
              Booztory is not directed at children under the age of 13. We do not knowingly collect any information
              from children. If you believe a child has used the platform, please contact us.
            </p>
          </div>

          {/* Section 8 */}
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-gray-900">8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be reflected by the &quot;Last
              updated&quot; date at the top of this page. Continued use of Booztory after changes are posted
              constitutes your acceptance of the updated policy.
            </p>
          </div>

          {/* Section 9 */}
          <div className="space-y-2 pb-4">
            <h2 className="text-base font-semibold text-gray-900">9. Contact</h2>
            <p>
              For any privacy-related questions, please reach out via{" "}
              <a href="https://x.com/booztory" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
                @booztory on X (Twitter)
              </a>
              .
            </p>
          </div>
        </div>
      </section>
      <Navbar />
    </main>
  )
}
