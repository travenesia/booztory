"use client"

import { useState } from "react"
import { useReadContracts, useWriteContract } from "wagmi"
import { waitForTransactionReceipt } from "wagmi/actions"
import { formatUnits, parseUnits, isAddress } from "viem"
import { TOKEN_ADDRESS, TOKEN_ABI, BOOZTORY_ADDRESS, RAFFLE_ADDRESS } from "@/lib/contract"
import { wagmiConfig, APP_CHAIN } from "@/lib/wagmi"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      <div className="rounded-xl border bg-white divide-y">{children}</div>
    </section>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function AdminTokenPage() {
  const [mintRecipient, setMintRecipient] = useState("")
  const [mintAmount, setMintAmount]       = useState("")
  const [isMinting, setIsMinting]         = useState(false)
  const [isTogglingPhase, setIsTogglingPhase] = useState(false)
  const [authorizingIndex, setAuthorizingIndex] = useState<number | null>(null)

  const { toast } = useToast()
  const { writeContractAsync } = useWriteContract()

  const { data, refetch } = useReadContracts({
    contracts: [
      // 0
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "name" },
      // 1
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "symbol" },
      // 2
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "totalSupply" },
      // 3
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "MAX_SUPPLY" },
      // 4
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "treasuryMinted" },
      // 5
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "TREASURY_CAP" },
      // 6
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "soulbound" },
      // 7
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "authorizedMinters", args: [BOOZTORY_ADDRESS] },
      // 8
      { address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: "authorizedMinters", args: [RAFFLE_ADDRESS] },
    ],
  })

  const [
    nameResult,
    symbolResult,
    totalSupplyResult,
    maxSupplyResult,
    treasuryMintedResult,
    treasuryCapResult,
    soulboundResult,
    booztoryMinterResult,
    raffleMinterResult,
  ] = data?.map(d => d.result) ?? []

  const totalSupply    = totalSupplyResult    as bigint  | undefined
  const maxSupply      = maxSupplyResult      as bigint  | undefined
  const treasuryMinted = treasuryMintedResult as bigint  | undefined
  const treasuryCap    = treasuryCapResult    as bigint  | undefined
  const isSoulbound    = soulboundResult      as boolean | undefined
  const booztoryAuthorized = booztoryMinterResult as boolean | undefined
  const raffleAuthorized   = raffleMinterResult   as boolean | undefined

  // Silence unused variable warnings (name/symbol available for future use)
  void nameResult
  void symbolResult

  const fmt = (v: bigint | undefined) =>
    v != null ? Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"

  const fmtSupply            = fmt(totalSupply)
  const fmtMaxSupply         = fmt(maxSupply)
  const fmtTreasuryMinted    = fmt(treasuryMinted)
  const fmtTreasuryCap       = fmt(treasuryCap)
  const treasuryRemaining    = (treasuryMinted != null && treasuryCap != null) ? treasuryCap - treasuryMinted : undefined
  const fmtTreasuryRemaining = fmt(treasuryRemaining)
  const treasuryExhausted    = treasuryMinted != null && treasuryCap != null && treasuryMinted >= treasuryCap
  const phaseLabel           = isSoulbound === undefined ? "—" : isSoulbound ? "Soulbound (Phase 1)" : "Transferable (Phase 2)"

  const KNOWN_MINTERS: Array<{ label: string; address: `0x${string}`; authorized: boolean | undefined; index: number }> = [
    { label: "Booztory Contract", address: BOOZTORY_ADDRESS, authorized: booztoryAuthorized, index: 0 },
    { label: "Raffle Contract",   address: RAFFLE_ADDRESS,   authorized: raffleAuthorized,   index: 1 },
  ]

  async function handleSetSoulbound(value: boolean) {
    setIsTogglingPhase(true)
    try {
      const tx = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "setSoulbound",
        args: [value],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      await refetch()
      toast({
        title: value ? "Transfers Disabled" : "Transfers Enabled",
        description: value ? "BOOZ is now soulbound again." : "BOOZ is now freely transferable (Phase 2).",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) {
        toast({ title: "Transaction Failed", variant: "destructive" })
      }
    } finally {
      setIsTogglingPhase(false)
    }
  }

  async function handleMintTreasury() {
    const recipient = mintRecipient.trim()
    const amount    = mintAmount.trim()
    if (!isAddress(recipient)) {
      toast({ title: "Invalid address", description: "Enter a valid 0x… recipient.", variant: "destructive" })
      return
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive BOOZ amount.", variant: "destructive" })
      return
    }
    setIsMinting(true)
    try {
      const tx = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "mintTreasury",
        args: [recipient as `0x${string}`, parseUnits(amount, 18)],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      setMintRecipient("")
      setMintAmount("")
      await refetch()
      toast({
        title: "Treasury Mint Successful",
        description: `Minted ${amount} BOOZ to ${recipient.slice(0, 10)}…`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) {
        toast({ title: "Mint Failed", variant: "destructive" })
      }
    } finally {
      setIsMinting(false)
    }
  }

  async function handleSetAuthorizedMinter(minterAddress: `0x${string}`, authorize: boolean, index: number) {
    setAuthorizingIndex(index)
    try {
      const tx = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: "setAuthorizedMinter",
        args: [minterAddress, authorize],
        chainId: APP_CHAIN.id,
      })
      await waitForTransactionReceipt(wagmiConfig, { hash: tx })
      await refetch()
      toast({
        title: authorize ? "Minter Authorized" : "Minter Revoked",
        description: `${minterAddress.slice(0, 10)}… ${authorize ? "can now mint BOOZ" : "can no longer mint BOOZ"}.`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (!msg.toLowerCase().includes("rejected")) {
        toast({ title: "Transaction Failed", variant: "destructive" })
      }
    } finally {
      setAuthorizingIndex(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Token Management</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage BOOZ supply, phase transitions, and authorized minters.
        </p>
      </div>

      {/* Section 1 — Token Overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Token Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Supply"
            value={fmtSupply}
            sub={maxSupply != null ? `/ ${fmtMaxSupply} max` : undefined}
          />
          <StatCard
            label="Treasury Minted"
            value={fmtTreasuryMinted}
            sub={treasuryCap != null ? `/ ${fmtTreasuryCap} cap` : undefined}
          />
          <StatCard
            label="Treasury Remaining"
            value={fmtTreasuryRemaining}
          />
          <StatCard
            label="Phase"
            value={phaseLabel}
          />
        </div>
      </section>

      {/* Section 2 — Soulbound Control */}
      <Section title="Soulbound Control">
        <div className="flex items-start justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Transfer Status</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Current phase:{" "}
              {isSoulbound === undefined ? (
                <span className="font-mono text-gray-400">—</span>
              ) : isSoulbound ? (
                <span className="font-semibold text-amber-600">Soulbound (Phase 1)</span>
              ) : (
                <span className="font-semibold text-emerald-600">Transferable (Phase 2)</span>
              )}
            </p>
            {isSoulbound === true && (
              <p className="text-xs text-destructive mt-1.5">
                Warning: enabling transfers cannot be undone. BOOZ will become freely transferable.
              </p>
            )}
          </div>
          <div className="shrink-0 pt-0.5">
            {isSoulbound === true && (
              <Button
                size="sm"
                variant="destructive"
                className="h-8 px-3"
                onClick={() => handleSetSoulbound(false)}
                disabled={isTogglingPhase}
              >
                {isTogglingPhase ? <Loader2 size={13} className="animate-spin" /> : "Enable Transfers (Phase 2)"}
              </Button>
            )}
            {isSoulbound === false && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3"
                onClick={() => handleSetSoulbound(true)}
                disabled={isTogglingPhase}
              >
                {isTogglingPhase ? <Loader2 size={13} className="animate-spin" /> : "Disable Transfers"}
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* Section 3 — Treasury Mint */}
      <Section title="Treasury Mint">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Treasury Remaining</p>
            <p className="text-sm font-mono font-semibold text-gray-700">
              {fmtTreasuryRemaining} BOOZ
            </p>
          </div>
          {treasuryExhausted && (
            <p className="text-xs text-destructive">Treasury cap reached. No further mints possible.</p>
          )}
          <div className="space-y-2">
            <Input
              className="h-8 text-sm font-mono"
              placeholder="Recipient address (0x…)"
              value={mintRecipient}
              onChange={e => setMintRecipient(e.target.value)}
              disabled={isMinting || treasuryExhausted}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  className="h-8 text-sm pr-14"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Amount"
                  value={mintAmount}
                  onChange={e => setMintAmount(e.target.value)}
                  disabled={isMinting || treasuryExhausted}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  BOOZ
                </span>
              </div>
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={handleMintTreasury}
                disabled={isMinting || treasuryExhausted || !mintRecipient.trim() || !mintAmount.trim()}
              >
                {isMinting ? <Loader2 size={13} className="animate-spin" /> : "Mint"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 4 — Authorized Minters */}
      <Section title="Authorized Minters">
        {KNOWN_MINTERS.map(({ label, address, authorized, index }) => (
          <div key={address} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800">{label}</p>
              <p className="text-xs font-mono text-muted-foreground truncate">{address}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {authorized === undefined ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : authorized ? (
                <span className="text-xs font-semibold text-emerald-600">Authorized ✓</span>
              ) : (
                <span className="text-xs font-semibold text-gray-400">Not authorized ✗</span>
              )}
              {authorized === true && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleSetAuthorizedMinter(address, false, index)}
                  disabled={authorizingIndex !== null}
                >
                  {authorizingIndex === index ? <Loader2 size={11} className="animate-spin" /> : "Revoke"}
                </Button>
              )}
              {authorized === false && (
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleSetAuthorizedMinter(address, true, index)}
                  disabled={authorizingIndex !== null}
                >
                  {authorizingIndex === index ? <Loader2 size={11} className="animate-spin" /> : "Authorize"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </Section>

      {/* Section 5 — Phase 2 Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">
          Phase 2 — DEX Liquidity Notes
        </p>
        <ol className="space-y-1.5 text-xs text-amber-800 list-decimal list-inside leading-relaxed">
          <li>
            Decide: <strong>Aerodrome</strong> (veAERO gauge required) vs{" "}
            <strong>Uniswap v3</strong> (simpler, no bribe)
          </li>
          <li>Mint treasury allocation via the Treasury Mint section above.</li>
          <li>
            Call{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">setSoulbound(false)</code>{" "}
            via Soulbound Control above.
          </li>
          <li>Create a BOOZ/USDC pool on the chosen DEX.</li>
          <li>Seed liquidity from the treasury-minted allocation.</li>
        </ol>
        <p className="text-xs text-amber-700 italic">
          Investor vesting: run{" "}
          <code className="font-mono bg-amber-100 px-1 rounded">scripts/createVesting.ts</code>{" "}
          when allocation is confirmed — no UI needed now.
        </p>
      </div>

      {/* Section 6 — Vesting Guide */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
          Vesting Guide
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-800">What is vesting?</p>
          <p className="text-xs text-gray-600 leading-relaxed">
            Vesting locks BOOZ tokens inside a smart contract (VestingWallet) and releases them to
            the beneficiary only after a set time. This prevents team members or investors from
            immediately dumping tokens after receiving them.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-800">How it works here</p>
          <ol className="space-y-1 text-xs text-gray-600 list-decimal list-inside leading-relaxed">
            <li>
              Edit <code className="font-mono bg-gray-100 px-1 rounded">scripts/vesting-config.json</code> with
              the beneficiary wallet address, BOOZ amount, cliff days, and linear days.
            </li>
            <li>
              Run <code className="font-mono bg-gray-100 px-1 rounded">npx hardhat run scripts/createVesting.ts --network base</code>.
              The script deploys one VestingWallet per beneficiary and funds it via{" "}
              <code className="font-mono bg-gray-100 px-1 rounded">mintTreasury</code> — this comes out of the Treasury cap above.
            </li>
            <li>
              The beneficiary calls{" "}
              <code className="font-mono bg-gray-100 px-1 rounded">release(TOKEN_ADDRESS)</code> on their
              VestingWallet contract after the cliff date to receive their tokens.
            </li>
          </ol>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-800">Vesting schedule types</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-700">Cliff only (team grants)</p>
              <p className="text-xs text-gray-500">
                <code className="font-mono bg-gray-100 px-1 rounded">cliffDays=365, linearDays=0</code>
              </p>
              <p className="text-xs text-gray-600">
                0% until 1 year. Then 100% unlocks at once on the cliff date.
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-700">Cliff + linear (investors)</p>
              <p className="text-xs text-gray-500">
                <code className="font-mono bg-gray-100 px-1 rounded">cliffDays=365, linearDays=730</code>
              </p>
              <p className="text-xs text-gray-600">
                0% until 1 year. Then drips linearly over 2 more years. Fully vested at year 3.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-800">Important notes</p>
          <ul className="space-y-1 text-xs text-gray-600 list-disc list-inside leading-relaxed">
            <li>
              Tokens minted to VestingWallets count against the{" "}
              <strong>10,000,000 BOOZ Treasury Cap</strong> — check Treasury Remaining above before running the script.
            </li>
            <li>
              VestingWallets hold tokens during Phase 1 (soulbound). The beneficiary can only
              call <code className="font-mono bg-gray-100 px-1 rounded">release()</code> after you call{" "}
              <code className="font-mono bg-gray-100 px-1 rounded">setSoulbound(false)</code> (Phase 2).
            </li>
            <li>
              The script saves a <code className="font-mono bg-gray-100 px-1 rounded">vesting-output-*.json</code> file
              with all deployed VestingWallet addresses — keep this file safe.
            </li>
            <li>
              VestingWallet ownership belongs to the beneficiary — you cannot claw back tokens
              once the wallet is funded. Double-check addresses in the config before running.
            </li>
          </ul>
        </div>
      </div>

    </div>
  )
}
