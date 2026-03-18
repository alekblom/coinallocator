# CoinAllocator

Deploy smart contracts that split incoming funds across multiple wallets by percentage.

## What it does

1. Connect your wallet
2. Configure recipients and percentages
3. Deploy a fund-splitting contract on-chain
4. Anyone sends funds to the contract address
5. Recipients claim their share or anyone triggers distribution

## Architecture

```
contract/       Anchor program (Solana)
frontend/       Vite 5 + TypeScript SPA
deploy.sh       Deployment helper script
```

### Smart Contract

Solana program built with Anchor 0.31.1. Four instructions:

- **create_split** - Deploy a new split with up to 10 recipients and basis-point shares
- **distribute** - Push funds to all recipients proportionally (anyone can call)
- **claim** - Pull model: a recipient claims their accumulated share
- **close_split** - Creator closes the split and reclaims rent

Funds are held in a PDA vault. Proportional accounting tracks `total_ever_received` so recipients always get their correct share regardless of when they claim.

### Frontend

Vanilla TypeScript SPA with hash-based routing. No framework dependencies. Wallet support for Phantom and Solflare.

Pages: Landing, Configure (with donut chart preview), Deploy (3-step flow with Stripe stub), Dashboard (live split cards with distribute/claim actions).

## Development

### Prerequisites

- Node.js 20+
- Rust / Cargo
- Solana CLI
- Docker (for Anchor builds on systems with glibc < 2.29)

### Frontend

```bash
cd frontend
npm install
npm run dev       # dev server on port 3000
npm run build     # production build to ../public/
```

### Smart Contract

Native build (requires glibc 2.29+):

```bash
cd contract
anchor build
```

Docker build (CentOS 8 / older systems):

```bash
cd contract
docker run --rm --network host -v "$(pwd)":/workdir -w /workdir ubuntu:22.04 bash -c '
  set -e && export DEBIAN_FRONTEND=noninteractive
  echo "nameserver 8.8.8.8" > /etc/resolv.conf
  apt-get update -qq && apt-get install -y -qq curl build-essential pkg-config libudev-dev libssl-dev
  curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.87.0
  export PATH="/root/.cargo/bin:$PATH"
  sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.8/install)"
  export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
  cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked
  anchor build
'
```

### Deploy to Devnet

```bash
solana airdrop 5          # get devnet SOL
./deploy.sh               # deploy program + rebuild frontend
```

## Roadmap

- [ ] Deploy to Solana devnet
- [ ] Stripe integration for $20 deployment fee
- [ ] SPL token support (not just SOL)
- [ ] EVM chain support (Ethereum, Base, Arbitrum)
- [ ] Sui / Move chain support
- [ ] Advanced modes: waterfall, conditional, time-based splits
- [ ] Mainnet deployment + security audit

## License

MIT
