#!/bin/bash
# CoinAllocator deployment script
# Usage: ./deploy.sh
#
# Prerequisites:
#   - SOL balance for rent (~1.8 SOL) + tx fees
#   - solana CLI configured for devnet
#   - Docker installed (for anchor build if needed)

set -e

PROGRAM_SO="contract/target/deploy/coin_allocator.so"
PROGRAM_KEYPAIR="contract/target/deploy/coin_allocator-keypair.json"
FRONTEND_DIR="frontend"
IDL_FILE="contract/target/idl/coin_allocator.json"

echo "=== CoinAllocator Deployment ==="
echo ""

# Check SOL balance
BALANCE=$(solana balance | awk '{print $1}')
echo "Wallet balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo ""
    echo "Insufficient SOL. Need ~2 SOL for deployment."
    echo "Try: solana airdrop 2"
    echo "Or visit: https://faucet.solana.com"
    exit 1
fi

# Check build artifacts
if [ ! -f "$PROGRAM_SO" ]; then
    echo "Program .so not found. Run anchor build first (via Docker):"
    echo ""
    echo "cd contract && docker run --rm --network host -v \"\$(pwd)\":/workdir -w /workdir ubuntu:22.04 bash -c '"
    echo "  set -e && export DEBIAN_FRONTEND=noninteractive"
    echo "  echo \"nameserver 8.8.8.8\" > /etc/resolv.conf"
    echo "  apt-get update -qq && apt-get install -y -qq curl build-essential pkg-config libudev-dev libssl-dev"
    echo "  curl --proto \"=https\" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.87.0"
    echo "  export PATH=\"/root/.cargo/bin:\$PATH\""
    echo "  sh -c \"\$(curl -sSfL https://release.anza.xyz/v3.1.8/install)\""
    echo "  export PATH=\"/root/.local/share/solana/install/active_release/bin:\$PATH\""
    echo "  cargo install --git https://github.com/coral-xyz/anchor --tag v0.31.1 anchor-cli --locked"
    echo "  anchor build"
    echo "'"
    exit 1
fi

echo "Program binary: $PROGRAM_SO ($(stat -c%s $PROGRAM_SO) bytes)"
echo ""

# Deploy program
echo "Deploying program to devnet..."
DEPLOY_OUTPUT=$(solana program deploy \
    --program-id "$PROGRAM_KEYPAIR" \
    "$PROGRAM_SO" \
    --url devnet \
    --commitment confirmed \
    2>&1)

echo "$DEPLOY_OUTPUT"

# Extract program ID
PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Program Id: \K\S+')
if [ -z "$PROGRAM_ID" ]; then
    PROGRAM_ID=$(solana address -k "$PROGRAM_KEYPAIR")
fi

echo ""
echo "Program ID: $PROGRAM_ID"
echo ""

# Update frontend constants
echo "Updating frontend program ID..."
sed -i "s|export const PROGRAM_ID = '.*'|export const PROGRAM_ID = '$PROGRAM_ID'|" "$FRONTEND_DIR/src/constants.ts"

# Rebuild frontend
echo "Rebuilding frontend..."
cd "$FRONTEND_DIR"
npx vite build
cd ..

echo ""
echo "=== Deployment Complete ==="
echo "Program ID: $PROGRAM_ID"
echo "Explorer: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
echo "Website: https://coinallocator.com"
