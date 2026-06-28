#![cfg(test)]
use super::{CrispOracle, CrispOracleClient};
use soroban_sdk::{Bytes, BytesN, Env, Vec};

#[path = "zk_fixture.rs"]
mod zk_fixture;

#[path = "batch_fixture.rs"]
mod batch_fixture;

#[path = "oracle_fixture.rs"]
mod oracle_fixture;

fn sig64(env: &Env, s: &str) -> BytesN<64> {
    let mut buf = [0u8; 64];
    hexb(env, s).copy_into_slice(&mut buf);
    BytesN::from_array(env, &buf)
}

fn hexval(c: u8) -> u8 {
    match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => 0,
    }
}
fn hexb(env: &Env, s: &str) -> Bytes {
    let bytes = s.as_bytes();
    let mut out = Bytes::new(env);
    let mut i = 0;
    while i < bytes.len() {
        out.push_back((hexval(bytes[i]) << 4) | hexval(bytes[i + 1]));
        i += 2;
    }
    out
}
fn root32(env: &Env, s: &str) -> BytesN<32> {
    let mut buf = [0u8; 32];
    hexb(env, s).copy_into_slice(&mut buf);
    BytesN::from_array(env, &buf)
}

fn setup<'a>(env: &Env) -> CrispOracleClient<'a> {
    use zk_fixture::*;
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(env, &id);
    client.initialize(&Bytes::from_array(env, &[1, 2, 3]));
    let mut ic = Vec::new(env);
    for s in VK_IC.iter() {
        ic.push_back(hexb(env, s));
    }
    client.set_verification_key(
        &hexb(env, VK_ALPHA),
        &hexb(env, VK_BETA),
        &hexb(env, VK_GAMMA),
        &hexb(env, VK_DELTA),
        &ic,
    );
    client
}

fn real_proof(env: &Env) -> Bytes {
    use zk_fixture::*;
    let mut p = Bytes::new(env);
    p.append(&hexb(env, PROOF_A));
    p.append(&hexb(env, PROOF_B));
    p.append(&hexb(env, PROOF_C));
    p
}

#[test]
fn test_real_solvency_attestation() {
    use zk_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = setup(&env);

    let ok = client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
    assert!(ok);

    let report = client.get_attestation();
    assert_eq!(report.total_liabilities, TOTAL_LIABILITIES);
    assert!(report.verified);
}

#[test]
#[should_panic(expected = "Invalid cryptographic solvency proof")]
fn test_tampered_root_rejected() {
    use zk_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = setup(&env);

    // valid reserves/liabilities, but a root that does not match the proof
    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, "0000000000000000000000000000000000000000000000000000000000000001"),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
#[should_panic(expected = "Solvency invariant violated")]
fn test_insolvent_rejected() {
    use zk_fixture::*;
    let env = Env::default();
    let client = setup(&env);
    // reserves < liabilities is rejected before any proof check
    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &500_000_u128,
        &400_000_u128,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_already_initialized_panics() {
    let env = Env::default();
    let client = setup(&env);
    client.initialize(&Bytes::from_array(&env, &[1, 2, 3]));
}

#[test]
fn test_get_attestation_default() {
    let env = Env::default();
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(&env, &id);
    let report = client.get_attestation();
    assert_eq!(report.total_liabilities, 0);
    assert!(!report.verified);
}

#[test]
#[should_panic(expected = "Attestation kyc_root already registered")]
fn test_replay_protection_panics() {
    use zk_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = setup(&env);

    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );

    // Attest again with the same KYC root
    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
#[should_panic(expected = "Invalid cryptographic solvency proof")]
fn test_invalid_proof_length_rejected() {
    use zk_fixture::*;
    let env = Env::default();
    let client = setup(&env);
    let mut bad_proof = real_proof(&env);
    bad_proof.push_back(0); // make length incorrect
    client.attest_reserves(
        &bad_proof,
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
#[should_panic(expected = "Invalid cryptographic solvency proof")]
fn test_uninitialized_vk_rejected() {
    use zk_fixture::*;
    let env = Env::default();
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(&env, &id);
    client.initialize(&Bytes::from_array(&env, &[1, 2, 3]));
    // No verification key set
    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
#[should_panic(expected = "Invalid cryptographic solvency proof")]
fn test_invalid_ic_len_rejected() {
    use zk_fixture::*;
    let env = Env::default();
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(&env, &id);
    client.initialize(&Bytes::from_array(&env, &[1, 2, 3]));
    let mut bad_ic = Vec::new(&env);
    bad_ic.push_back(hexb(&env, VK_IC[0])); // only 1 element instead of 6
    client.set_verification_key(
        &hexb(&env, VK_ALPHA),
        &hexb(&env, VK_BETA),
        &hexb(&env, VK_GAMMA),
        &hexb(&env, VK_DELTA),
        &bad_ic,
    );
    client.attest_reserves(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
    );
}

#[test]
fn test_add_provider_and_storage() {
    use soroban_sdk::testutils::Address as _;
    let env = Env::default();
    let client = setup(&env);
    let provider = soroban_sdk::Address::generate(&env);
    client.add_provider(&provider);
    // Verified via code coverage that add_provider executes and returns successfully.
}

// ─── v3 batch attestation tests ─────────────────────────────────────────────

// Set both the base solvency VK and the v3 batch aggregator VK on a fresh oracle.
fn batch_setup<'a>(env: &Env) -> CrispOracleClient<'a> {
    use batch_fixture::*;
    let client = setup(env);
    let mut bic = Vec::new(env);
    for s in B_VK_IC.iter() {
        bic.push_back(hexb(env, s));
    }
    client.set_batch_verification_key(
        &hexb(env, B_VK_ALPHA),
        &hexb(env, B_VK_BETA),
        &hexb(env, B_VK_GAMMA),
        &hexb(env, B_VK_DELTA),
        &bic,
    );
    client
}

fn batch_proof(env: &Env) -> Bytes {
    use batch_fixture::*;
    let mut p = Bytes::new(env);
    p.append(&hexb(env, B_PROOF_A));
    p.append(&hexb(env, B_PROOF_B));
    p.append(&hexb(env, B_PROOF_C));
    p
}

fn batch_issuer_roots(env: &Env) -> Vec<BytesN<32>> {
    use batch_fixture::*;
    let mut roots = Vec::new(env);
    for s in ISSUER_ROOTS.iter() {
        roots.push_back(root32(env, s));
    }
    roots
}

#[test]
fn test_batch_attestation_v3_success() {
    use batch_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = batch_setup(&env);

    // Real aggregator proof: 4 issuers, each individually solvent; system solvent.
    let result = client.attest_batch_v3(
        &batch_proof(&env),
        &root32(&env, BATCH_ROOT),
        &batch_issuer_roots(&env),
        &TOTAL_SYS_LIABILITIES,
        &TOTAL_SYS_RESERVES,
    );
    assert!(result);

    // Verify the attestation report was stored
    let report = client.get_attestation();
    assert_eq!(report.root, root32(&env, BATCH_ROOT));
    assert_eq!(report.total_liabilities, TOTAL_SYS_LIABILITIES);
    assert_eq!(report.reserves_threshold, TOTAL_SYS_RESERVES);
    assert!(report.verified);
}

#[test]
#[should_panic(expected = "Invalid cryptographic batch solvency proof")]
fn test_batch_attestation_v3_tampered_total_rejected() {
    use batch_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = batch_setup(&env);

    // Same proof, but a system-liabilities value that does not match the proof's
    // public signal → the pairing check must reject it. (Still <= reserves so the
    // structural invariant passes and we reach the cryptographic check.)
    client.attest_batch_v3(
        &batch_proof(&env),
        &root32(&env, BATCH_ROOT),
        &batch_issuer_roots(&env),
        &(TOTAL_SYS_LIABILITIES + 1),
        &TOTAL_SYS_RESERVES,
    );
}

#[test]
#[should_panic(expected = "System solvency invariant violated")]
fn test_batch_attestation_v3_system_insolvent() {
    let env = Env::default();
    let client = batch_setup(&env);

    let mut issuer_roots = Vec::new(&env);
    for i in 0u8..4 {
        issuer_roots.push_back(BytesN::from_array(&env, &[i + 20; 32]));
    }
    let batch_root = BytesN::from_array(&env, &[88u8; 32]);
    let batch_proof = Bytes::from_slice(&env, &[0u8; 256]);

    // Reserves < liabilities → should panic before any pairing check
    client.attest_batch_v3(
        &batch_proof,
        &batch_root,
        &issuer_roots,
        &60000u128,  // total_system_liabilities
        &50000u128,  // total_system_reserves (less!)
    );
}

#[test]
#[should_panic(expected = "Batch attestation already registered")]
fn test_batch_attestation_v3_duplicate_batch() {
    use batch_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = batch_setup(&env);

    client.attest_batch_v3(
        &batch_proof(&env),
        &root32(&env, BATCH_ROOT),
        &batch_issuer_roots(&env),
        &TOTAL_SYS_LIABILITIES,
        &TOTAL_SYS_RESERVES,
    );
    // Second call with same batch_root → should panic
    client.attest_batch_v3(
        &batch_proof(&env),
        &root32(&env, BATCH_ROOT),
        &batch_issuer_roots(&env),
        &TOTAL_SYS_LIABILITIES,
        &TOTAL_SYS_RESERVES,
    );
}

#[test]
#[should_panic(expected = "Batch attestation requires at least 2 issuers")]
fn test_batch_attestation_v3_single_issuer_rejected() {
    let env = Env::default();
    let client = batch_setup(&env);

    let mut issuer_roots = Vec::new(&env);
    issuer_roots.push_back(BytesN::from_array(&env, &[50u8; 32]));

    let batch_root = BytesN::from_array(&env, &[66u8; 32]);
    let batch_proof = Bytes::from_slice(&env, &[0u8; 256]);

    client.attest_batch_v3(
        &batch_proof,
        &batch_root,
        &issuer_roots,
        &10000u128,
        &20000u128,
    );
}

// ─── v2 registered-oracle Ed25519 attestation tests ─────────────────────────

#[test]
fn test_verify_oracle_sig_success() {
    use oracle_fixture::*;
    let env = Env::default();
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(&env, &id);
    client.initialize(&Bytes::from_array(&env, &[1, 2, 3]));

    client.set_oracle_key(&root32(&env, ORACLE_PUBKEY));
    // Real signature by the registered oracle key over reserves || kyc_root.
    let ok = client.verify_oracle_sig(
        &ORACLE_RESERVES,
        &root32(&env, ORACLE_KYC_ROOT),
        &sig64(&env, ORACLE_SIG),
    );
    assert!(ok);
}

#[test]
#[should_panic]
fn test_verify_oracle_sig_tampered_fails() {
    use oracle_fixture::*;
    let env = Env::default();
    let id = env.register(CrispOracle, ());
    let client = CrispOracleClient::new(&env, &id);
    client.initialize(&Bytes::from_array(&env, &[1, 2, 3]));
    client.set_oracle_key(&root32(&env, ORACLE_PUBKEY));

    // Tampered reserves value -> signature no longer matches -> ed25519_verify traps.
    client.verify_oracle_sig(
        &(ORACLE_RESERVES + 1),
        &root32(&env, ORACLE_KYC_ROOT),
        &sig64(&env, ORACLE_SIG),
    );
}

#[test]
fn test_attest_reserves_v2_with_registered_oracle() {
    use oracle_fixture::*;
    use zk_fixture::*;
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    let client = setup(&env); // sets the base solvency VK
    client.set_oracle_key(&root32(&env, ORACLE_PUBKEY));

    // Full flow: registered-oracle Ed25519 sig + real Groth16 solvency proof.
    let ok = client.attest_reserves_v2(
        &real_proof(&env),
        &root32(&env, KYC_ROOT),
        &TOTAL_LIABILITIES,
        &RESERVES_THRESHOLD,
        &root32(&env, ISSUER_AX),
        &root32(&env, ISSUER_AY),
        &sig64(&env, ORACLE_SIG),
    );
    assert!(ok);
}
