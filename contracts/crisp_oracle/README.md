# Crisp Oracle Contract 🔬

A secure, zero-knowledge-gated solvency and proof-of-reserves oracle built for Stellar Soroban. This contract processes cryptographic solvency attestations (using a real Groth16 zk-SNARK verifier over the BN254 curve) to verify that an issuer's reserves cover their total liabilities without leaking the exact balances on-chain.

## Architecture & Design
- **Language**: Rust
- **Platform**: Soroban (Stellar Smart Contracts)
- **Toolchain**: Target `wasm32-unknown-unknown` (production builds require `wasm32v1-none` under Rust 1.82+ to support native BN254 host functions).

## API Endpoints

### `initialize(env: Env, admin: Bytes)`
Initializes the contract by setting the contract administrator. Prevents re-initialization.

### `set_verification_key(env: Env, alpha: Bytes, beta: Bytes, gamma: Bytes, delta: Bytes, ic: Vec<Bytes>)`
Updates the Groth16 verification key (VK) stored in instance storage.

### `add_provider(env: Env, provider: Address)`
Registers an approved provider to the allowlist.

### `attest_reserves(env, proof, kyc_root, total_liabilities, reserves_threshold, issuer_ax, issuer_ay) -> bool`
Processes a new solvency attestation.
Checks:
1. Solvency invariant (reserves must cover liabilities).
2. Replay protection (verifies the `kyc_root` nullifier has not been registered).
3. Groth16 pairing check (verifies the proof against the stored VK and public inputs reconstructed on-chain).
Saves the attestation report and returns `true`.

### `get_attestation(env: Env) -> AttestationReport`
Retrieves the latest verified solvency attestation report.

## Unit Testing
Run contract unit tests:
```bash
cargo test
```
