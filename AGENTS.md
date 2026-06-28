<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# 🔬 Crisp — Agent Instructions

## Project

Real-Time Zero-Knowledge Proof-of-Reserves & Solvency Oracle for Stellar Issuers.

## Hackathon

**Stellar Hacks: Real-World ZK 2026** — Proving compliance and privacy at host speed.

## Structure

- `contracts/` — Soroban smart contract source code (`CrispOracle`)
- `circuits/` — ZK solvency constraint circuits (Circom)
- `src/app/` — Next.js 16 App Router pages & API routes
- `src/components/` — React 19 UI components
- `src/lib/` — Shared client libraries, SnarkJS wrappers
- `scripts/` — Automated release, testing, and benchmark scripts

## Tech Stack

| Layer               | Technology                            |
| ------------------- | ------------------------------------- |
| **Frontend**        | Next.js 16 (App Router), React 19     |
| **Styling**         | Tailwind CSS v4                       |
| **ZK Circuits**     | Circom (Groth16), snarkjs WASM prover |
| **Smart Contracts** | Soroban (Rust SDK)                    |
| **Database**        | Supabase (PostgreSQL)                 |
| **CI/CD**           | GitHub Actions                        |

## Key Rules

- **Frontend** = ESM (`import`), Next.js 16, React 19, Tailwind v4
- **Contracts Compiler Target** = `wasm32v1-none` under Rust 1.82+ to support native BN254 host functions.
- **CI** = `npm run ci` -> audit + lint + typecheck + test:coverage (must pass 100%)
- **Colors** = Cyan (#06b6d4) for primary accent, Emerald (#10b981) for success/payouts, Slate (#1e293b) for backgrounds
- **Typography** = Outfit (headings), Inter (body), JetBrains Mono (data/numbers)
- **Aesthetic** = Cyberpunk-terminal / Military SOC, dark mode only, glassmorphism cards

## Critical Patterns

- All state initialization uses **lazy initializers** (not setState-in-useEffect)
- `params` is a **Promise** in Next.js 16 — must `await`
- `PageProps<'/path'>` and `RouteContext<'/path'>` are global type helpers
- Components using hooks must have `'use client'` directive
- Ref updates go in `useEffect`, never during render
- Unused catch variables use underscore prefix (`_err`)

## Commits & Releases

- **Conventional Commits required** — all commit messages MUST follow the format: `type(scope): description`
- Types: `feat`, `fix`, `perf`, `refactor`, `chore`, `docs`, `ci`, `test`, `style`
- Release bump: handled automatically in Stage 6 CI via `scripts/release-bump.ts`
