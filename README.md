<div align="center">
  <h1>⚡ Zaka-Stream</h1>
  <p><strong>Decentralized Token Streaming Protocol on Stellar / Soroban</strong></p>
  <p>
    <a href="https://github.com/zakayola/Zaka-Stream/actions"><img src="https://img.shields.io/github/actions/workflow/status/zakayola/Zaka-Stream/ci.yml?label=CI&style=flat-square" alt="CI Status"/></a>
    <a href="https://github.com/zakayola/Zaka-Stream/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"/></a>
    <a href="https://discord.gg/drips"><img src="https://img.shields.io/badge/Drips-Wave%20Program-purple?style=flat-square" alt="Drips Wave"/></a>
    <img src="https://img.shields.io/badge/Soroban-Testnet-orange?style=flat-square" alt="Soroban"/>
    <img src="https://img.shields.io/badge/monorepo-Turborepo-EF4444?style=flat-square" alt="Turborepo"/>
  </p>
</div>

---

## What is Zaka-Stream?

**Zaka-Stream** is a trustless, fully on-chain token streaming protocol built on the [Stellar](https://stellar.org) blockchain using [Soroban](https://soroban.stellar.org) smart contracts. It enables any wallet to lock tokens into a time-based stream and have them flow **continuously and linearly** to a recipient — second by second — without intermediaries.

### 🎯 Primary Use Cases

| Use Case | Description |
|---|---|
| **Decentralized Payroll** | DAOs and Web3-native companies pay contributors in real-time, replacing monthly batch transfers with continuous flows |
| **Grant Distribution** | Drips Wave and similar programs release grant funds progressively, aligned with contributor milestones |
| **Vesting Schedules** | Token vesting with on-chain enforcement — no trusted custodian required |
| **Subscription Payments** | Time-gated access to services with automatic, streaming payments |

### 🧮 How Streaming Works (The Math)

Zaka-Stream uses a **linear distribution model**:

```
tokens_per_second  = total_amount ÷ duration_seconds
streamed_at_now    = tokens_per_second × (current_timestamp − start_time)
withdrawable       = streamed_at_now − already_withdrawn
```

All amounts are stored in the token's smallest denomination (e.g., stroops for XLM: 1 XLM = 10,000,000 stroops). This avoids floating-point entirely, keeping the contract deterministic and safe.

On **cancellation**: the sender reclaims `total_amount − streamed_at_now`; the recipient can withdraw the already-streamed but un-withdrawn portion.

---

## 🏗️ Repository Architecture

This is a [Turborepo](https://turbo.build) monorepo with three interconnected packages:

```
zaka-stream/
├── packages/
│   ├── contracts/        # Rust / Soroban smart contract
│   ├── backend/          # Node.js / Fastify indexer & REST API
│   └── frontend/         # Next.js 14 streaming dashboard
├── package.json          # Root workspace config
├── turbo.json            # Turborepo pipeline
├── README.md
└── CONTRIBUTING.md
```

### `packages/contracts` — On-Chain Logic
The Soroban contract is the source of truth. It exposes:
- `create_stream(sender, recipient, token, total_amount, duration_secs)` — locks tokens and records the stream
- `withdraw_from_stream(stream_id, recipient)` — sends the withdrawable portion to the recipient
- `cancel_stream(stream_id, sender)` — cancels the stream, splits the remainder

### `packages/backend` — Off-Chain Indexer
A Fastify API that:
- Polls Soroban contract events and indexes them into a local `.json` store
- Exposes REST endpoints: `GET /streams?sender=G...` and `GET /streams?receiver=G...`

### `packages/frontend` — The Dashboard
A Next.js 14 app with:
- **Freighter wallet** connect/disconnect
- **Live Balance counter** — updates in real-time using `setInterval` and the linear math
- **New Stream form** — create a stream by invoking the Soroban contract directly

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20 | JS runtime |
| Rust + Cargo | latest | Soroban contract build |
| `stellar` CLI | latest | Contract deployment |
| `wasm-opt` | latest | WASM optimization |

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Install Node dependencies
npm install
```

### Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/zakayola/Zaka-Stream.git
cd Zaka-Stream

# 2. Install all workspace dependencies
npm install

# 3. Copy environment files
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env.local

# 4. Start all services in parallel
npm run dev
```

This starts:
- **Frontend** → http://localhost:3000
- **Backend** → http://localhost:3001

### Build Everything

```bash
npm run build
```

Turborepo will build `contracts` first (WASM), then `backend` and `frontend` in parallel.

### Deploy Contract to Testnet

```bash
cd packages/contracts
chmod +x deploy.sh
./deploy.sh
```

---

## 🔗 Links

- **GitHub:** https://github.com/zakayola/Zaka-Stream
- **Author:** [AlAfiz](https://github.com/AlAfiz)
- **Organization:** [zakayola](https://github.com/zakayola)
- **Drips Wave Program:** https://www.drips.network

---

## 📄 License

MIT © 2025 [AlAfiz](https://github.com/AlAfiz) / [zakayola](https://github.com/zakayola)
