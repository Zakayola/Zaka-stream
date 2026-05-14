# Contributing to Zaka-Stream

Thank you for your interest in contributing to **Zaka-Stream**! This project is part of the [Drips Wave Program](https://www.drips.network), and we welcome contributors of all experience levels. Your contributions help build a more open, decentralized financial infrastructure on Stellar.

**Repository:** https://github.com/zakayola/Zaka-Stream  
**Maintainer:** [AlAfiz](https://github.com/AlAfiz)

---

## 🌊 Drips Wave Contributor Program

Zaka-Stream participates in the **Drips Wave grant program**. Contributors can earn points that translate into grant funding. Issues are labeled by difficulty and point value.

### Point Tiers

| Tier | Points | Label | Description |
|---|---|---|---|
| 🟢 **Trivial** | 100 pts | `drips:trivial` | Small, well-scoped tasks with clear acceptance criteria |
| 🟡 **Medium** | 150 pts | `drips:medium` | Moderate complexity; may require reading existing code |
| 🔴 **High** | 200 pts | `drips:high` | Significant engineering work; requires deep understanding of the stack |

---

## 📋 Available Issues by Layer

### 🎨 Frontend (`packages/frontend`) — Trivial (100pts)

**UI Color Tweaks & Theme Refinement**
- Adjust the primary brand gradient to use a more vibrant hue
- Improve the dark/light mode toggle animation timing
- Make the Live Balance counter pulsate smoothly when a stream is active
- Standardize padding and spacing using the Tailwind spacing scale

**README / Documentation Clarifications**
- Add inline code comments to `lib/freighter.ts` explaining the Freighter connect flow
- Expand the "Getting Started" section with Windows-specific setup notes
- Add a FAQ section covering common Testnet issues

### ⚙️ Backend (`packages/backend`) — Medium (150pts)

**Stream History Endpoint**
- Implement `GET /streams/:streamId/history` that returns a log of all withdrawal events for a given stream
- The indexer (`src/indexer.ts`) should persist withdrawal events with timestamps into the local JSON store
- Write integration tests using `vitest` for the new endpoint
- Update API documentation in `README.md` under `packages/backend`

**Enhanced Indexer Reliability**
- Add retry logic with exponential backoff to the Soroban event poller
- Implement a startup health-check that verifies the contract exists on the configured network
- Add structured logging with `pino` instead of raw `console.log`

### 🦀 Contracts (`packages/contracts`) — High (200pts)

**Non-Linear Streaming Curves**
- Implement a **cliff + linear** model: no tokens are withdrawable until a configurable `cliff_time` passes, then linear streaming begins
- Implement an **exponential decay** curve: `streamed = total × (1 − e^(−λt))` using fixed-point i128 arithmetic (no floating point in WASM)
- Add a `stream_type` enum to the `Stream` struct: `{ Linear, CliffLinear, ExponentialDecay }`
- Write Soroban unit tests for all three curve types in `src/lib.rs`
- Update `deploy.sh` to include the new contract ABI

**Math Note for Exponential Decay:**
Since Soroban runs in a deterministic WASM environment without `libm`, implement `e^x` using a fixed-point Taylor series expansion truncated to sufficient precision for token amounts.

---

## 🔧 Development Workflow

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/Zaka-Stream.git
cd Zaka-Stream
npm install
```

### 2. Create a Branch

Use the naming convention:
```
feat/your-feature-name
fix/bug-description
docs/what-you-documented
```

```bash
git checkout -b feat/stream-history-endpoint
```

### 3. Make Your Changes

Follow the package-specific guides:

- **contracts/**: Run `cargo test` before submitting
- **backend/**: Run `npm run lint && npm test`
- **frontend/**: Run `npm run build` to catch type errors

### 4. Open a Pull Request

- Reference the issue number: `Closes #42`
- Fill in the PR template
- Tag `@AlAfiz` for review

---

## 📐 Code Standards

| Language | Tool | Config |
|---|---|---|
| TypeScript | ESLint + Prettier | `.eslintrc.json`, `.prettierrc` |
| Rust | `cargo fmt` + `cargo clippy` | `rustfmt.toml` |
| Commits | Conventional Commits | `feat:`, `fix:`, `docs:`, `chore:` |

### Commit Message Format

```
feat(backend): add stream history endpoint

- Persists withdrawal events with ISO timestamps
- Adds GET /streams/:id/history route
- Covers edge case where stream was never withdrawn

Closes #23
```

---

## 🏛️ Architecture Notes for Contributors

Before diving in, read:

1. `README.md` — Project overview and streaming math
2. `packages/contracts/src/lib.rs` — The core invariants (all business logic lives here)
3. `packages/backend/src/indexer.ts` — How off-chain state is derived from contract events
4. `packages/frontend/lib/contract.ts` — How the frontend invokes the Soroban contract

---

## 🤝 Code of Conduct

Be kind. Be constructive. We follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

---

*Questions? Open a [GitHub Discussion](https://github.com/zakayola/Zaka-Stream/discussions) or reach out to [AlAfiz](https://github.com/AlAfiz).*
