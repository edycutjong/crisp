# Crisp ZK Solvency Oracle Circuits 🔬

This directory contains the Zero-Knowledge (ZK) Proof-of-Solvency circuits for **Crisp**, built using **Circom**. The circuits prove, without revealing individual user account identifiers or balances, that an issuer's total reserves cover their total liabilities.

## Circuit Specifications

- **Language:** Circom `2.1.6`
- **Proof System:** Groth16 (compiled with snarkjs and Barretenberg/Noir compatible constraints)
- **Hash Primitive:** Poseidon (for arithmetically efficient hashing over BN254/BabyJubjub fields)
- **Merkle-Sum Tree Depth:** 4 (supporting up to 16 leaf accounts in the tree, scalable)

## Circuits Overview

### 1. `solvency.circom` (`SolvencyVerifier`)
Computes the liabilities sum and root hash using a Merkle-Sum Tree and asserts that the issuer is solvent:
*   **Merkle-Sum Tree Construction:** Computes leaf hashes as $Leaf = \text{Poseidon}(accountId, balance, salt)$. Computes parent hashes as $ParentHash = \text{Poseidon}(leftHash, leftSum, rightHash, rightSum)$.
*   **Balance Validation:** Asserts that all private balances are non-negative.
*   **Root Constraining:** Constrains that the computed root hash and root sum match the public `expectedLiabilitiesRoot` and `expectedLiabilitiesSum`.
*   **Solvency Range Check:** Asserts that the public `reserves` balance is greater than or equal to the total liabilities sum (`expectedLiabilitiesSum <= reserves`).
*   **Signature Verification:** Verifies the issuer's EdDSA-Poseidon signature over the computed `expectedLiabilitiesRoot` using their public key `(issuerAx, issuerAy)`.

#### Signal Map: `solvency.circom`
| Parameter | Type | Visibility | Description |
|---|---|---|---|
| `expectedLiabilitiesRoot`| `signal` | **Public** | Expected root hash of the Merkle-Sum Tree |
| `expectedLiabilitiesSum` | `signal` | **Public** | Sum of all user liabilities in the tree |
| `reserves` | `signal` | **Public** | Total reserves held in the issuer's treasury |
| `issuerAx` / `issuerAy` | `signal` | **Public** | Issuer's BabyJubjub public key coordinates |
| `accountIds[16]` | `signal` | **Private** | Private array of user account identifiers |
| `balances[16]` | `signal` | **Private** | Private array of individual user balances |
| `salts[16]` | `signal` | **Private** | Private salts for individual user leaf commitments |
| `sigS` / `sigR8x` / `sigR8y` | `signal` | **Private** | EdDSA signature components |

---

## Development Commands

Run these commands inside the `circuits/` folder:

```bash
# Compile solvency circuit to R1CS and WASM
circom solvency.circom --r1cs --wasm --sym --html --output ./build

# Generate proof inputs using snarkjs
snarkjs groth16 setup build/solvency.r1cs powersOfTau28_hez_final_12.ptau build/solvency_0000.zkey
```

To run the full end-to-end proving and verification demo, run the following command from the project root:
```bash
npm run prove:demo
```
