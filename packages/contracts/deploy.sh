#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Zaka-Stream Contract Deployment to Stellar Testnet
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Prerequisites:
#   - stellar CLI installed (cargo install --locked stellar-cli --features opt)
#   - Rust with wasm32-unknown-unknown target
#   - A funded Testnet account identity named "zaka-deployer" in stellar CLI
#     Run: stellar keys generate --global zaka-deployer --network testnet
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────
NETWORK="testnet"
IDENTITY="zaka-deployer"
WASM_PATH="target/wasm32-unknown-unknown/release/zaka_stream_contract.wasm"
CONTRACT_ID_FILE=".contract-id"

echo ""
echo "⚡ Zaka-Stream — Soroban Contract Deployer"
echo "=========================================="
echo "  Network  : $NETWORK"
echo "  Identity : $IDENTITY"
echo ""

# ── Step 1: Build the contract ────────────────────────────
echo "🔨 Building WASM (release)..."
cargo build --target wasm32-unknown-unknown --release 2>&1

# Optional: optimize with wasm-opt if available
if command -v wasm-opt &> /dev/null; then
  echo "🔧 Optimizing WASM with wasm-opt..."
  wasm-opt -Oz \
    "$WASM_PATH" \
    -o "$WASM_PATH"
  echo "   Size after opt: $(wc -c < "$WASM_PATH") bytes"
else
  echo "⚠️  wasm-opt not found — skipping optimization (install with: npm i -g wasm-opt)"
fi

# ── Step 2: Ensure we have a funded Testnet identity ─────
echo ""
echo "🔑 Checking identity '$IDENTITY'..."
if ! stellar keys show "$IDENTITY" &>/dev/null; then
  echo "   Identity not found. Generating..."
  stellar keys generate --global "$IDENTITY" --network "$NETWORK"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$IDENTITY")
echo "   Address: $DEPLOYER_ADDRESS"

echo ""
echo "💧 Funding via Friendbot..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER_ADDRESS" \
  | jq -r '.[] | @json' 2>/dev/null || true
echo ""

# ── Step 3: Upload the WASM ───────────────────────────────
echo "📤 Uploading contract WASM to Testnet..."
WASM_HASH=$(stellar contract upload \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --wasm "$WASM_PATH" \
  --fee 100000)

echo "   WASM Hash: $WASM_HASH"

# ── Step 4: Deploy the contract ───────────────────────────
echo ""
echo "🚀 Deploying contract instance..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash "$WASM_HASH" \
  --network "$NETWORK" \
  --source "$IDENTITY" \
  --fee 100000)

echo "   Contract ID: $CONTRACT_ID"
echo "$CONTRACT_ID" > "$CONTRACT_ID_FILE"

# ── Step 5: Summary ───────────────────────────────────────
echo ""
echo "✅ Deployment complete!"
echo "=========================================="
echo "  Contract ID : $CONTRACT_ID"
echo "  WASM Hash   : $WASM_HASH"
echo "  Network     : $NETWORK"
echo "  Saved to    : $CONTRACT_ID_FILE"
echo ""
echo "Next steps:"
echo "  1. Copy the Contract ID above into packages/backend/.env"
echo "     CONTRACT_ID=$CONTRACT_ID"
echo "  2. Copy into packages/frontend/.env.local"
echo "     NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
echo ""
echo "🔍 Inspect on Stellar Expert:"
echo "   https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
