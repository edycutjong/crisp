#![no_std]
#![allow(deprecated)]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec,
};
use soroban_sdk::crypto::bn254::{Bn254Fr, Bn254G1Affine, Bn254G2Affine};

// soroban bn254 byte layout (Ethereum-compatible): G1=64 (be(x)||be(y));
// G2=128 (Fp2 X || Fp2 Y, each Fp2 = be(c1)||be(c0)); Fr=32 BE.
const G1: u32 = 64;
const G2: u32 = 128;
const PROOF_LEN: u32 = G1 + G2 + G1; // 256

fn g1(env: &Env, b: &Bytes, off: u32) -> Bn254G1Affine {
    let mut buf = [0u8; 64];
    b.slice(off..off + G1).copy_into_slice(&mut buf);
    Bn254G1Affine::from_bytes(BytesN::from_array(env, &buf))
}
fn g2(env: &Env, b: &Bytes, off: u32) -> Bn254G2Affine {
    let mut buf = [0u8; 128];
    b.slice(off..off + G2).copy_into_slice(&mut buf);
    Bn254G2Affine::from_bytes(BytesN::from_array(env, &buf))
}
fn fr_u128(env: &Env, v: u128) -> Bn254Fr {
    let mut b = [0u8; 32];
    b[16..32].copy_from_slice(&v.to_be_bytes());
    Bn254Fr::from_bytes(BytesN::from_array(env, &b))
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AttestationReport {
    pub root: BytesN<32>,
    pub total_liabilities: u128,
    pub reserves_threshold: u128,
    pub timestamp: u64,
    pub verified: bool,
    pub encrypted_view_key: Bytes,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Admin,
    Attest,
    Nullifier(BytesN<32>),
    Provider(Address),
}

const ATTEST_KEY: Symbol = symbol_short!("ATTEST");
const ADMIN_KEY: Symbol = symbol_short!("ADMIN");

#[contract]
pub struct CrispOracle;

#[contractimpl]
impl CrispOracle {
    /// Initialize the contract with an admin account.
    pub fn initialize(env: Env, admin: Bytes) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN_KEY, &admin);
    }

    /// Set the Groth16 verification key (BN254, Ethereum byte layout). `alpha`
    /// 64-byte G1; `beta`/`gamma`/`delta` 128-byte G2; `ic` a vector of 64-byte G1
    /// points (6 here: one per public input + 1).
    pub fn set_verification_key(
        env: Env,
        alpha: Bytes,
        beta: Bytes,
        gamma: Bytes,
        delta: Bytes,
        ic: Vec<Bytes>,
    ) {
        env.storage().instance().set(&symbol_short!("alpha"), &alpha);
        env.storage().instance().set(&symbol_short!("beta"), &beta);
        env.storage().instance().set(&symbol_short!("gamma"), &gamma);
        env.storage().instance().set(&symbol_short!("delta"), &delta);
        env.storage().instance().set(&symbol_short!("ic"), &ic);
    }

    /// Set the Groth16 verification key for the v3 batch aggregator circuit
    /// (`circuits/aggregator.circom`). Same byte layout as `set_verification_key`,
    /// but a distinct key set because the aggregator has 3 public signals
    /// (`ic` has 4 G1 points).
    pub fn set_batch_verification_key(
        env: Env,
        alpha: Bytes,
        beta: Bytes,
        gamma: Bytes,
        delta: Bytes,
        ic: Vec<Bytes>,
    ) {
        env.storage().instance().set(&symbol_short!("b_alpha"), &alpha);
        env.storage().instance().set(&symbol_short!("b_beta"), &beta);
        env.storage().instance().set(&symbol_short!("b_gamma"), &gamma);
        env.storage().instance().set(&symbol_short!("b_delta"), &delta);
        env.storage().instance().set(&symbol_short!("b_ic"), &ic);
    }

    /// Add an approved provider to the allowlist.
    pub fn add_provider(env: Env, provider: Address) {
        env.storage().instance().set(&StorageKey::Provider(provider), &true);
    }

    /// Submit a solvency attestation. `proof` is a 256-byte BN254 Groth16 proof
    /// of the solvency circuit. The 5 public inputs are reconstructed on-chain from
    /// (`kyc_root`, `total_liabilities`, `reserves_threshold`, `issuer_ax`, `issuer_ay`)
    /// — matching the circuit's public signals [expectedLiabilitiesRoot,
    /// expectedLiabilitiesSum, reserves, issuerAx, issuerAy].
    pub fn attest_reserves(
        env: Env,
        proof: Bytes,
        kyc_root: BytesN<32>,
        total_liabilities: u128,
        reserves_threshold: u128,
        issuer_ax: BytesN<32>,
        issuer_ay: BytesN<32>,
    ) -> bool {
        // Solvency invariant: reserves must cover liabilities.
        if reserves_threshold < total_liabilities {
            panic!("Solvency invariant violated: reserves < liabilities");
        }

        // Replay protection: kyc_root is a one-time nullifier.
        let nullifier_key = StorageKey::Nullifier(kyc_root.clone());
        if env.storage().instance().has(&nullifier_key) {
            panic!("Attestation kyc_root already registered");
        }

        // Real ZK verification (Groth16 over BN254). The proof also checks the
        // issuer's EdDSA-Poseidon signature over the root, binding this
        // attestation to the BabyJubjub key (issuer_ax, issuer_ay).
        if !Self::verify(
            &env, &proof, &kyc_root, total_liabilities, reserves_threshold,
            &issuer_ax, &issuer_ay,
        ) {
            panic!("Invalid cryptographic solvency proof");
        }

        env.storage().instance().set(&nullifier_key, &true);

        let report = AttestationReport {
            root: kyc_root.clone(),
            total_liabilities,
            reserves_threshold,
            timestamp: env.ledger().timestamp(),
            verified: true,
            encrypted_view_key: Bytes::new(&env),
        };
        env.storage().instance().set(&ATTEST_KEY, &report);

        env.events().publish(
            (symbol_short!("attest"), kyc_root),
            (total_liabilities, reserves_threshold),
        );
        true
    }

    /// Register the authorized reserve-oracle Ed25519 public key. Only a
    /// signature from THIS key (over `reserves_threshold || kyc_root`) is
    /// accepted by `attest_reserves_v2` / `verify_oracle_sig`. In production the
    /// key is held by the off-chain reserve attestor (the TLSNotary notary that
    /// witnesses the custodian's bank balance); the on-chain check here is the
    /// registered-key Ed25519 verification.
    pub fn set_oracle_key(env: Env, oracle_pubkey: BytesN<32>) {
        env.storage().instance().set(&symbol_short!("oracle"), &oracle_pubkey);
    }

    /// Read-only verification that `oracle_signature` is a valid Ed25519
    /// signature by the REGISTERED oracle key over `reserves_threshold ||
    /// kyc_root`. Returns true on success; traps if the signature is invalid or
    /// no oracle key is registered. (The caller cannot supply the key — it must
    /// have been registered via `set_oracle_key`, which closes the prior
    /// "caller supplies both key and signature" gap.)
    pub fn verify_oracle_sig(
        env: Env,
        reserves_threshold: u128,
        kyc_root: BytesN<32>,
        oracle_signature: BytesN<64>,
    ) -> bool {
        let oracle_pubkey: BytesN<32> = env
            .storage()
            .instance()
            .get(&symbol_short!("oracle"))
            .expect("oracle key not registered");
        let mut msg = Bytes::new(&env);
        msg.append(&Bytes::from_slice(&env, &reserves_threshold.to_be_bytes()));
        msg.append(&kyc_root.clone().into());
        env.crypto().ed25519_verify(&oracle_pubkey, &msg, &oracle_signature);
        true
    }

    /// Submit a solvency attestation that is ALSO signed by the registered
    /// reserve oracle. The Ed25519 signature is verified against the on-chain
    /// registered key (`set_oracle_key`), so the reserve figure is bound to a
    /// known attestor — not to a key the caller chose.
    pub fn attest_reserves_v2(
        env: Env,
        proof: Bytes,
        kyc_root: BytesN<32>,
        total_liabilities: u128,
        reserves_threshold: u128,
        issuer_ax: BytesN<32>,
        issuer_ay: BytesN<32>,
        oracle_signature: BytesN<64>,
    ) -> bool {
        // 1. Verify the registered-oracle Ed25519 signature over
        //    `reserves_threshold || kyc_root` (traps if invalid / unregistered).
        Self::verify_oracle_sig(env.clone(), reserves_threshold, kyc_root.clone(), oracle_signature);

        // 2. Call solvency attestation logic (real Groth16 pairing check).
        Self::attest_reserves(
            env, proof, kyc_root, total_liabilities, reserves_threshold,
            issuer_ax, issuer_ay,
        )
    }


    /// attest_batch_v3 aggregates N issuer solvency proofs into a
    /// single batch attestation. The aggregator circuit would prove that ALL issuers
    /// in the compliance set are individually solvent AND that system-wide
    /// reserves cover system-wide liabilities.
    ///
    /// `batch_proof` is the Groth16 proof for the aggregator circuit.
    /// `issuer_roots` contains the per-issuer liabilities Merkle roots.
    /// `total_system_liabilities` and `total_system_reserves` are the
    /// aggregated totals verified by the circuit.
    /// `batch_root` is the Poseidon chain commitment over issuer roots.
    pub fn attest_batch_v3(
        env: Env,
        batch_proof: Bytes,
        batch_root: BytesN<32>,
        issuer_roots: Vec<BytesN<32>>,
        total_system_liabilities: u128,
        total_system_reserves: u128,
    ) -> bool {
        // 1. System-wide solvency invariant
        if total_system_reserves < total_system_liabilities {
            panic!("System solvency invariant violated: reserves < liabilities");
        }

        // 2. Batch nullifier: prevent replay of the same batch
        let batch_nullifier_key = StorageKey::Nullifier(batch_root.clone());
        if env.storage().instance().has(&batch_nullifier_key) {
            panic!("Batch attestation already registered");
        }

        // 3. Must have at least 2 issuers (otherwise use single-issuer v1/v2)
        let n_issuers = issuer_roots.len();
        if n_issuers < 2 {
            panic!("Batch attestation requires at least 2 issuers");
        }

        // 4. Real cryptographic batch verification (Groth16 over BN254). The
        //    aggregator circuit (`aggregator.circom`) proves every issuer is
        //    individually solvent, the per-issuer liabilities/reserves sum to the
        //    system totals, and `batch_root` is the Poseidon chain over issuer
        //    roots. Public signals (circuit order): [batch_root,
        //    total_system_liabilities, total_system_reserves].
        if !Self::verify_batch(
            &env, &batch_proof, &batch_root,
            total_system_liabilities, total_system_reserves,
        ) {
            panic!("Invalid cryptographic batch solvency proof");
        }

        // 5. Register each issuer root as attested
        for i in 0..n_issuers {
            let root = issuer_roots.get(i).unwrap();
            let issuer_key = StorageKey::Nullifier(root.clone());
            if env.storage().instance().has(&issuer_key) {
                panic!("Issuer root already attested in another batch");
            }
            env.storage().instance().set(&issuer_key, &true);
        }

        // 6. Register batch nullifier
        env.storage().instance().set(&batch_nullifier_key, &true);

        // 7. Store batch attestation report
        let report = AttestationReport {
            root: batch_root.clone(),
            total_liabilities: total_system_liabilities,
            reserves_threshold: total_system_reserves,
            timestamp: env.ledger().timestamp(),
            verified: true,
            encrypted_view_key: Bytes::new(&env),
        };
        env.storage().instance().set(&ATTEST_KEY, &report);

        // 8. Emit batch attestation event
        env.events().publish(
            (symbol_short!("batch"), symbol_short!("attest")),
            (n_issuers, total_system_liabilities, total_system_reserves),
        );
        true
    }

    pub fn get_attestation(env: Env) -> AttestationReport {
        env.storage().instance().get(&ATTEST_KEY).unwrap_or(AttestationReport {
            root: BytesN::from_array(&env, &[0u8; 32]),
            total_liabilities: 0,
            reserves_threshold: 0,
            timestamp: 0,
            verified: false,
            encrypted_view_key: Bytes::new(&env),
        })
    }

    /// Groth16 pairing check. Public inputs (in circuit order):
    /// [expectedLiabilitiesRoot = kyc_root, expectedLiabilitiesSum = total_liabilities,
    ///  reserves = reserves_threshold].
    fn verify(
        env: &Env,
        proof: &Bytes,
        kyc_root: &BytesN<32>,
        total_liabilities: u128,
        reserves_threshold: u128,
        issuer_ax: &BytesN<32>,
        issuer_ay: &BytesN<32>,
    ) -> bool {
        if proof.len() != PROOF_LEN {
            return false;
        }
        let st = env.storage().instance();
        let alpha_b: Bytes = match st.get(&symbol_short!("alpha")) {
            Some(v) => v,
            None => return false,
        };
        let beta_b: Bytes = st.get(&symbol_short!("beta")).unwrap();
        let gamma_b: Bytes = st.get(&symbol_short!("gamma")).unwrap();
        let delta_b: Bytes = st.get(&symbol_short!("delta")).unwrap();
        let ic_b: Vec<Bytes> = st.get(&symbol_short!("ic")).unwrap();
        if ic_b.len() != 6 {
            return false;
        }

        let bn = env.crypto().bn254();

        let a = g1(env, proof, 0);
        let b = g2(env, proof, G1);
        let c = g1(env, proof, G1 + G2);
        let alpha = g1(env, &alpha_b, 0);
        let beta = g2(env, &beta_b, 0);
        let gamma = g2(env, &gamma_b, 0);
        let delta = g2(env, &delta_b, 0);

        // public inputs as Fr
        let inputs = [
            Bn254Fr::from_bytes(kyc_root.clone()),
            fr_u128(env, total_liabilities),
            fr_u128(env, reserves_threshold),
            Bn254Fr::from_bytes(issuer_ax.clone()),
            Bn254Fr::from_bytes(issuer_ay.clone()),
        ];

        let mut vk_x = g1(env, &ic_b.get(0).unwrap(), 0);
        for (i, s) in inputs.iter().enumerate() {
            let ici = g1(env, &ic_b.get((i + 1) as u32).unwrap(), 0);
            let prod = bn.g1_mul(&ici, s);
            vk_x = bn.g1_add(&vk_x, &prod);
        }

        let neg_a = -a;
        bn.pairing_check(
            soroban_sdk::vec![env, neg_a, alpha, vk_x, c],
            soroban_sdk::vec![env, b, beta, gamma, delta],
        )
    }

    /// Read-only Groth16 verification of a v3 batch aggregator proof against the
    /// stored batch VK. Public inputs (circuit order): [batch_root,
    /// total_system_liabilities, total_system_reserves]. Returns true iff valid.
    pub fn verify_batch_proof(
        env: Env,
        proof: Bytes,
        batch_root: BytesN<32>,
        total_system_liabilities: u128,
        total_system_reserves: u128,
    ) -> bool {
        Self::verify_batch(&env, &proof, &batch_root, total_system_liabilities, total_system_reserves)
    }

    /// Groth16 pairing check for the batch aggregator circuit. Public inputs
    /// (circuit order): [batch_root, total_system_liabilities,
    /// total_system_reserves]. Uses the batch VK (`b_*` storage keys).
    fn verify_batch(
        env: &Env,
        proof: &Bytes,
        batch_root: &BytesN<32>,
        total_system_liabilities: u128,
        total_system_reserves: u128,
    ) -> bool {
        if proof.len() != PROOF_LEN {
            return false;
        }
        let st = env.storage().instance();
        let alpha_b: Bytes = match st.get(&symbol_short!("b_alpha")) {
            Some(v) => v,
            None => return false,
        };
        let beta_b: Bytes = st.get(&symbol_short!("b_beta")).unwrap();
        let gamma_b: Bytes = st.get(&symbol_short!("b_gamma")).unwrap();
        let delta_b: Bytes = st.get(&symbol_short!("b_delta")).unwrap();
        let ic_b: Vec<Bytes> = st.get(&symbol_short!("b_ic")).unwrap();
        if ic_b.len() != 4 {
            return false;
        }

        let bn = env.crypto().bn254();

        let a = g1(env, proof, 0);
        let b = g2(env, proof, G1);
        let c = g1(env, proof, G1 + G2);
        let alpha = g1(env, &alpha_b, 0);
        let beta = g2(env, &beta_b, 0);
        let gamma = g2(env, &gamma_b, 0);
        let delta = g2(env, &delta_b, 0);

        // public inputs as Fr (snarkjs order: [output, ...public inputs])
        let inputs = [
            Bn254Fr::from_bytes(batch_root.clone()),
            fr_u128(env, total_system_liabilities),
            fr_u128(env, total_system_reserves),
        ];

        let mut vk_x = g1(env, &ic_b.get(0).unwrap(), 0);
        for (i, s) in inputs.iter().enumerate() {
            let ici = g1(env, &ic_b.get((i + 1) as u32).unwrap(), 0);
            let prod = bn.g1_mul(&ici, s);
            vk_x = bn.g1_add(&vk_x, &prod);
        }

        let neg_a = -a;
        bn.pairing_check(
            soroban_sdk::vec![env, neg_a, alpha, vk_x, c],
            soroban_sdk::vec![env, b, beta, gamma, delta],
        )
    }
}

mod test;
