# CoinAllocator.com - Project Plan

## Concept
UI-driven platform to deploy smart contracts that allocate/split incoming funds per user-defined rules.

## Monetization
- Open source on GitHub
- $20 one-time fee via Stripe to deploy via UI
- Stripe billing centralized under "Buidlings" brand (shared with generor.com)
- Stripe statement descriptor: `BUIDLINGS* COINALLOCATOR`

## Allocation Modes
- Percentage-based splits (e.g. 50/30/20 to 3 addresses)
- Flat equal splits
- Waterfall/priority (pay address A first up to X, then remainder to address B)
- Conditional splits (if balance > X, route Y%)
- Time-based / vesting schedules

## Target Chains
- **Solana** (MVP - existing Anchor experience)
- Ethereum/EVM (Foundry tooling installed)
- Sui (Move - greenfield opportunity, no competitors)

## MVP Scope (Solana first)
1. UI to configure split recipients + percentages
2. Deploy a Solana program (PDA-based instance)
3. Anyone sends SOL/SPL tokens to the split address
4. Recipients claim or auto-distribute
5. Dashboard showing inflows, balances, claim history

## Tech Stack
- **Smart contracts**: Anchor (Solana), Foundry (EVM), Move (Sui)
- **Frontend**: Vite + wallet adapters
- **Payments**: Stripe Checkout (shared with generor.com via buidlings.com API)
- **Hosting**: CWP on internetieruser account

## Deploy Flow
```
Connect Wallet -> Configure Split -> Preview Contract -> Pay $20 (Stripe) -> Deploy -> Dashboard
```

## Competitive Landscape
- **0xSplits** (splits.org) - EVM only, open source, no deployment fee
- **Superfluid** - streaming payment splits
- **Squads (Solana)** - treasury management

## Differentiators vs 0xSplits
- Multi-chain (Solana + Sui + EVM)
- Richer allocation modes (waterfall, conditional, time-based) built-in
- Better UX / visual flow builder
- Sui support (no competitors exist there)

## Notes
- Security is critical - contracts handle user funds, audits needed before mainnet
- Gas costs are separate from $20 platform fee - communicate clearly in UX
- Consider: free redeploys on bug fixes? Volume pricing for DAOs later?
- Someone will fork and build a free UI eventually - first mover + UX + maintenance is the moat
