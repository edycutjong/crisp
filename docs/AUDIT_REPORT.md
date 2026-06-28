# Crisp — Security & Invariant Audit Report

This report outlines the protocol invariants, cryptographic assumptions, threat vectors, and residual risks for **Crisp**, the zero-knowledge solvency checker.

---

## 1. Protocol Invariants

### 1.1. Solvency Invariant

The on-chain contract guarantees that an attestation is only marked successful if:
$$\text{Reserves\_Threshold} \ge \text{Total\_Liabilities}$$
If this assertion fails, the contract must transaction-panic and revert all state changes.

### 1.2. Balance Inclusion Invariant

For any customer leaf node $A_i$ with balance $B_i$ and blinding factor $S_i$ included in the tree with root $R$:
$$\text{Verify\_Leaf}(A_i, B_i, S_i, \text{Path}_i) == R$$
If the computed root does not match the committed root, the inclusion check is rejected.

### 1.3. Non-Negative Balance Invariant

To prevent negative-balance underflow attacks (where an issuer inserts mock accounts with negative balances to artificially reduce total liabilities), the ZK circuit enforces:
$$B_i \ge 0 \quad \forall \quad i \in [0, N-1]$$
using a 64-bit range constraint.

---

## 2. Threat Vector Analysis & Mitigation

### 2.1. Reserve Oracle Trust (Centralization Risk)

- **Threat**: The reserve threshold value $R$ represents off-chain bank balances. If the issuer manually submits $R$, or if the reserve oracle feed is compromised, the issuer can assert solvency while actually being insolvent.
- **Mitigation**: Production systems must implement multi-signature oracle feeds linked directly to custodian APIs (e.g., Circle, Prime Trust) or utilize decentralization bridges (e.g., Chainlink or Band Protocol) to sign and verify fiat reserves.

### 2.2. Timing and Latency Attacks (Intra-day Insolvency)

- **Threat**: Stablecoins transact 24/7, but ZK attestations are periodic (e.g., daily). An issuer could lose solvency intra-day, settle customer funds, and only deposit collateral right before the next attestation block.
- **Mitigation**: Move towards continuous micro-attestations. Because Protocol 25/26 reduces CPU instruction fees by 88%, the gas overhead is small enough to run solvency attestations multiple times per hour.

### 2.3. Sibling Path Manipulation

- **Threat**: An attacker attempts to forge an inclusion proof by altering the sibling hashes in their path.
- **Mitigation**: Because every parent node is a cryptographic hash of both child hashes and sums, mutating any node in the path will propagate up and yield a root hash mismatch. The security of the tree is bound by the preimage resistance of the Poseidon2 hashing algorithm.
